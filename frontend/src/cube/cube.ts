import nj from '@d4c/numjs';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addForRender, removeForRender, requestRenderIfNotRequested } from './render';
import { getAxisIndex, getClosestOrthogonalVector, getNormal, getRotationAxis, getTurnDirection } from './utils';
import { parse_move, getFace, LayerMove } from './move';
import { roundedSquare } from './geometries';
import keybinds from './keybindings';

export const DEFAULT_SPEED_MODE=true;

function getDefaultCubeState(size: number) : string {
    let state = "";
    const colors = "WGRBOY";
    for (const color of colors) {
        for (let i = 0; i < size * size; ++i) {
            state += color;
        }
    }
    return state;
}

// we need to keep the following information when a sticker is clicked in mousedown event
// until the mouseup event is fired to decide what the move will be
interface MouseDownInfo {
    clickedScreenX: number;
    clickedScreenY: number;
    clickedSticker: THREE.Object3D<THREE.Object3DEventMap>;
    clickedCoordinates: THREE.Vector3
}

export default class Cube {
    private size: number
    private speedMode: boolean = DEFAULT_SPEED_MODE;

    // in inspection, we ignore moves that would turn the cube
    private inspection: boolean = false


    // three.js
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    orbitCamera: OrbitControls

    // speed and normal modes have different meshes (3D objects with textures) to render
    private speedModeMeshes: THREE.Mesh[] = []
    private normalModeMeshes: THREE.Mesh[] = []

    // since numjs does not support ndarray for non numeric types
    // create a flat array of THREE.Groups, indices from this array are elements
    // of the 3-dimensional cubieIndices array
    private cubies: Array<THREE.Group> = []
    private cubieIndices!: nj.NdArray

    // we have to remember state between mousedown and mouseup events are fired
    private mousedownInfo?: MouseDownInfo;

    // current animation - can be cancelled
    private tween?: TWEEN.Tween<THREE.Euler>

    defaultPerformMove = true;

    // functions that are called when camera position changes
    private onCameraCallbacks: Array<(pos: THREE.Vector3) => void> = []

    // functions that are called when a move is done
    private onMoveCallbacks: Array<(move: string) => void> = []

    // eventListeners - if we want to remove event listener, we need to pass
    // both the event name and the function. Since foo.bind(bar) != foo.bind(bar)
    // we have to store the references to the originaly added event listeners
    // https://stackoverflow.com/a/9720991
    private onKeydownHandler: (event: KeyboardEvent) => void;
    private onMousedownHandler: (event: MouseEvent) => void;
    private onMouseupHandler: (event: MouseEvent) => void;
    private onResizeHandler: () => void;

    constructor(n: number, state?: string) {
        this.size = n;

        // initialize three.js scene
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        // init orbit controls - move around the cube
        this.orbitCamera = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitCamera.enablePan = false; // disable right mouse button camera panning (side to side movement)
        this.orbitCamera.addEventListener('change', () => this.onCameraChange());

        if (!state) {
            state = getDefaultCubeState(this.size);
        }
        this.setState(state);

        this.onKeydownHandler = this.onKeyDown.bind(this)
        this.onMousedownHandler = this.onMousedown.bind(this);
        this.onMouseupHandler = this.onMouseup.bind(this);
        this.onResizeHandler = this.resizeCanvas.bind(this);
    }

    initControls() {
        document.addEventListener("keydown", this.onKeydownHandler);
        document.addEventListener("mousedown", this.onMousedownHandler);
        document.addEventListener("mouseup", this.onMouseupHandler);
        window.addEventListener("resize", this.onResizeHandler);
    }

    destroyControls() {
        document.removeEventListener("keydown", this.onKeydownHandler);
        document.removeEventListener("mousedown", this.onMousedownHandler);
        document.removeEventListener("mouseup", this.onMouseupHandler);
        window.removeEventListener("resize", this.onResizeHandler);
    }

    private setZoomMinDistance() {
        // half of the cube diagonal length + some extra distance
        const distance = (Math.sqrt(3) * this.size) / 2 + 0.5;
        this.orbitCamera.minDistance = distance;
    }

    private initInternalState() {
        const n = this.size;
        const cubiesCount = n*n*n;

        this.cubies = []
        for (var i = 0; i < cubiesCount; ++i) {
            this.cubies.push(new THREE.Group());
        }

        this.generateCubies()

        // create NxNxN array - cube representation
        // elements of this array are indices to this.cubies array
        // numjs does not to have groups as array elements
        this.cubieIndices = nj.arange(cubiesCount).reshape(n, n, n)

        // position cubies in space
        // use offset, so the middle of the cube is at (0, 0, 0)
        const offset = -(this.size - 1) / 2;
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const cubieIndex = this.cubieIndices.get(i, j, k);
                    const cubie = this.cubies[cubieIndex];
                    cubie.position.set(
                        offset + i,
                        offset + j,
                        offset + k
                    );
                    this.scene.add(cubie);
                }
            }
        }
    }

    startInspection() {
        this.inspection = true;
    }

    startSolve() {
        this.inspection = false;
    }

    reset() {
        this.setState(getDefaultCubeState(this.size));
    }

    setState(state: string) {
        this.initInternalState();
        this.draw(state);
    }

    mount(container: HTMLElement) {
        container.appendChild(this.renderer.domElement);
        this.resizeCanvas();
    }

    unmount(container: HTMLElement) {
        container.removeChild(this.renderer.domElement);
    }

    onCameraChange() {
        this.render();
        for (const fun of this.onCameraCallbacks) {
            fun(this.camera.position);
        }
    }


    updateCamera(new_position: THREE.Vector3) {
        this.camera.position.copy(new_position);
        this.camera.lookAt(0, 0, 0);
        this.render();
    }

    cameraUpdate(x: number, y: number, z: number) {
        this.camera.position.x = x;
        this.camera.position.y = y;
        this.camera.position.z = z;
        this.camera.lookAt(0, 0, 0);
        this.render();
    }

    addOnMoveEventListener(callback: (move: string) => void) {
        this.onMoveCallbacks.push(callback);
    }

    addOnCameraEventListener(callback: (pos: THREE.Vector3) => void) {
        this.onCameraCallbacks.push(callback);
    }

    resizeCanvas() {
        const container = this.renderer.domElement.parentElement;
        if (!container) return;
        this.renderer.setSize(container.clientWidth, container.clientHeight, false);
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix(); // must be called after changing camera's properties
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    private toggleMeshes() {
        for (const mesh of this.speedModeMeshes) {
            mesh.visible = this.speedMode;
        }
        for (const mesh of this.normalModeMeshes) {
            mesh.visible = !this.speedMode;
        }
    }

    setSpeedMode(speedMode: boolean) {
        if (this.speedMode === speedMode) return; // no change

        this.speedMode = speedMode;
        this.toggleMeshes();
        this.render();
    }

    setSize(newSize: number) {
        this.size = newSize;
        this.initInternalState();
        this.draw(getDefaultCubeState(newSize));
    }

    private getMesh(color: string, speedMode: boolean) {
        let colors = new Map([
            ["R", 0xff1100], // red
            ["O", 0xffa200], // orange
            ["W", 0xffffff], // white
            ["Y", 0xfffb00], // yellow
            ["G", 0x33ff00], // green
            ["B", 0x0800ff]  // blue
        ]);

        if (speedMode) {
            const stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
            const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors.get(color), side: THREE.DoubleSide} );
            const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
            return stickerMesh;
        } else {
            // const stickerGeometry = new THREE.PlaneGeometry(0.9, 0.9)
            const stickerGeometry = roundedSquare(0.9, 0.1, 3);
            const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors.get(color)} );
            const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
            return stickerMesh;
        }
    }

    private drawStickers(state: string = "") {
        const n = this.size;

        let faceCenters = [
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, -1, 0),
        ];

        let faces = [
            this.getLayer("y", n - 1).T,
            nj.rot90(this.getLayer("z", n - 1), 1),
            nj.rot90(this.getLayer("x", n - 1), 2),
            nj.rot90(this.getLayer("z", 0), 2).T,
            nj.rot90(this.getLayer("x", 0), -1).T,
            nj.rot90(this.getLayer("y", 0), 1)
        ]

        for (let face_i = 0; face_i < 6; ++face_i) {
            const face_stickers = state.slice(face_i * n*n, (face_i + 1) * (n*n));
            const face_group_indices = faces[face_i];
            for (let i = 0; i < n; ++i) {
                for (let j = 0; j < n; ++j) {
                    const group_index = face_group_indices.get(i, j);
                    const group = this.cubies[group_index];

                    const normalMesh = this.getMesh(face_stickers[n * i + j], false);
                    normalMesh.lookAt(faceCenters[face_i]);
                    group.add(normalMesh);
                    normalMesh.translateZ(0.5)
                    this.normalModeMeshes.push(normalMesh)

                    const speedMesh = this.getMesh(face_stickers[n * i + j], true);
                    speedMesh.lookAt(faceCenters[face_i]);
                    group.add(speedMesh);
                    speedMesh.translateZ(0.5)
                    this.speedModeMeshes.push(speedMesh)
                }
            }
        }
    }

    private generateCubies() {
        const boxGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        for (const cubie of this.cubies) {
            const box = boxMesh.clone();
            this.normalModeMeshes.push(box);
            cubie.add(box);
        }
    }

    private draw(state: string) {
        // clear the scene
        this.scene.remove.apply(this.scene, this.scene.children);

        this.camera.position.set(0, this.size + this.size / 2 - 1.2, this.size + this.size / 2 + 1)
        this.camera.lookAt(0, 0, 0);
        this.setZoomMinDistance();

        // visualize the axes
        // X is red, Y is green, Z is blue
        // const axesHelper = new THREE.AxesHelper( 10 );
        // this.scene.add( axesHelper );

        for (const group of this.cubies) {
            this.scene.add(group);
        }


        this.drawStickers(state);
        this.toggleMeshes();

        // const light = new THREE.AmbientLight( 0xffffff, 0.5 );
        // this.scene.add(light)

        this.render();
    }

    private getAxisRemapping() {
        // camera position might have changed - when resizing the cube
        this.orbitCamera.update();

        const angle = this.orbitCamera.getAzimuthalAngle()*180/Math.PI;
        // oldAxis -> [newAxis, negateAxis]
        const remapping = new Map();
        if (-45 <= angle && angle <= 45) {
            // nothing
        } else if (45 < angle && angle < 135) {
            // x = -z; z = x;
            remapping.set("x", ["z", true]);
            remapping.set("z", ["x", false]);
        } else if (135 < angle || angle < -135) {
            // x = -x; z = -z;
            remapping.set("x", ["x", true]);
            remapping.set("z", ["z", true]);
        } else {
            // x = z; z = -x;
            remapping.set("x", ["z", false]);
            remapping.set("z", ["x", true]);
        }

        return remapping;
    }

    makeKeyboardMove(move_str: string) {
        if (this.orbitCamera) {
            const remapping = this.getAxisRemapping();
            const move = parse_move(move_str);

            if (remapping.has(move.axis)) {
                const [newAxis, negateAxis] = remapping.get(move.axis);
                move.changeAxis(newAxis, negateAxis);
            }

            move_str = move.toString();
        }
        this.makeMove(move_str);
    }

    private getLayer(axis: string, index: number) {
        let x = null, y = null, z = null;
        if (axis === "x") {
            x = index;
        } else if (axis === "y") {
            y = index;
        } else if (axis === "z") {
            z = index;
        } else {
        }
        // arr.pick type annotation seems wrong - it accepts null values
        // therefore "as any" usage
        return this.cubieIndices.pick(x as any, y as any, z as any);
    }

    private rotate_layer(axis: string, index: number, dir: number) {
        if (axis === "y") { dir *= -1; }
        const layer = this.getLayer(axis, index);
        const rotated = nj.rot90(layer, -1 * dir).clone()

        for (let i = 0; i < this.size; ++i) {
            for (let j = 0; j < this.size; ++j) {
                layer.set(i, j, rotated.get(i, j))
            }
        }
    }

    animationForceEnd() {
        // cancel current move animation
        // if previous move animation was still in progress, force it to end
        // this would not work correctly without calling .stop() first
        if (this.tween && this.tween.isPlaying()) {
            this.tween.stop();
            this.tween.end();
        }
    }

    makeMove(move_string: string, send: boolean=true, performMove=this.defaultPerformMove) {
        if (this.inspection && !["x", "x'", "y", "y'", "z", "z'"].includes(move_string)) {
            return;
        }

        this.animationForceEnd();

        if (send) {
            for (const fun of this.onMoveCallbacks) {
                fun(move_string);
            }
        }

        if (!performMove) {
            return;
        }

        const move = parse_move(move_string);
        // get actual move direction
        // for example clockwise rotation of the right face and clockwise
        // rotation of the left face rotate the pieces in opposite directions
        // around the same axis
        const direction = (move.double) ? 2 : ((move.flipped) ? move.dir * -1 : move.dir);

        // group all cubies that are being rotated
        // the group has a pivot (the point around which we rotate)
        // at (0, 0, 0). Rotating individual cubies before adding them first
        // to a group with a pivot rotates them around their own axis.
        const tweenGroup = new THREE.Group();
        this.scene.add(tweenGroup);

        // get layer indices of layers we rotate
        // for rotations, this is [0, ..., n-1]
        const indices = move.get_indices(this.size);

        for (let index of indices) {
            // get all cubies from given layer
            const layer = this.getLayer(move.axis, index);
            // rotate cubies in internal object representation
            this.rotate_layer(move.axis, index, direction)

            // get cubies objects that will be rotated
            const group_indices = layer.flatten().tolist() as Array<number>;
            for (const group_index of group_indices) {
                tweenGroup.attach(this.cubies[group_index]);
            }
        }

        // rotate layer on screen
        this.tween = new TWEEN.Tween(tweenGroup.rotation)
                        .to({[move.axis]: -1 * direction * Math.PI / 2}, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => {
                            removeForRender(this);
                            // remove all cubies from group that was used for rotating the cubies
                            // on screen and remove the group from the scene
                            for (var i = tweenGroup.children.length - 1; i >= 0; --i) {
                                this.scene.attach(tweenGroup.children[i]);
                            }
                            this.scene.remove(tweenGroup);
                            this.render(); // without this, big cube slice moves are not animated until the very end of them
                        }).start();

        // add cube to render queue
        addForRender(this);
        requestRenderIfNotRequested();
    }

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
            return;
        }
        let move_str = keybinds.get(event.key);
        if (move_str) {
            this.makeKeyboardMove(move_str);
        }
    }

    private onMousedown(event: MouseEvent) {
        // calculate pointer position in NDC - normalized device coordinates
        // in NDC, canvas bottom left corner is [-1, -1], top right is [1, 1]
        // offsets are useful when the canvas is not full page
        const canvas = this.renderer.domElement;
        const pointer = new THREE.Vector2(    // const arr = nj.arange(n*n*n).reshape(n, n, n)
            ((event.clientX - canvas.offsetLeft) / canvas.clientWidth) * 2 - 1,
            - ((event.clientY - canvas.offsetTop) / canvas.clientHeight) * 2 + 1
        )

        // find stickers under the pointer
        // note that it is possible to click stickers, that cannot be directly
        // seen from our point of view (e.g. stickers on the back face)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this.camera);
        const intersectedStickers = raycaster.intersectObjects(this.cubies);

        if (intersectedStickers.length === 0) {
            this.mousedownInfo = undefined;
            return;
        }

        // a sticker was clicked - the user wants to make a move
        // disable camera rotation, so the desired mouse movement does not move the camera
        this.orbitCamera.enabled = false;

        this.mousedownInfo = {
            clickedScreenX: event.clientX,
            clickedScreenY: event.clientY,
            clickedSticker: intersectedStickers[0].object,
            clickedCoordinates: intersectedStickers[0].point
        }
    }

    private onMouseup(event: MouseEvent) {
        if (this.mousedownInfo === undefined) {
            // no sticker was clicked in mousedown event
            return;
        }

        this.orbitCamera.enabled = true;

        // calculate cursor movement direction
        const mouseVector = new THREE.Vector2(
            event.clientX - this.mousedownInfo.clickedScreenX,
            event.clientY - this.mousedownInfo.clickedScreenY
        )

        if (mouseVector.length() <= 10) {
            // the mouse movement was very short - possibly just a click
            return;
        }

        const stickerNormal = getNormal(this.mousedownInfo.clickedSticker);
        const moveDirection = getClosestOrthogonalVector(stickerNormal, this.mousedownInfo.clickedCoordinates, mouseVector, this.camera);

        const [axis, axisVector] = getRotationAxis(moveDirection, stickerNormal);

        let coord = getAxisIndex(axis, this.mousedownInfo.clickedSticker);

        // exception fro middle layer
        const flipped = coord < 0 || (axis === "x" && coord === 0);
        const face = getFace(axis, flipped, coord === 0);

        coord = Math.abs(coord);

        const outerLayerPosition = (this.size - 1) / 2;
        const layerIndex = Math.abs(coord - outerLayerPosition) + 1;
        const turnDirection = getTurnDirection(axisVector, this.mousedownInfo.clickedCoordinates, moveDirection, flipped);

        const moveObj = new LayerMove(face, axis, flipped, layerIndex, turnDirection, false, false);
        this.makeMove(moveObj.toString());
    }
}