import nj from '@d4c/numjs';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addForRender, removeForRender, requestRenderIfNotRequested } from './render';
import { getOrtogonalVectors, getScreenCoordinates } from './utils';
import { parse_move, getFace, LayerMove } from './move';

export const DEFAULT_SPEED_MODE=true;

class Axis {
    axis: string
    vector: THREE.Vector3
    constructor(axis: string, vector: THREE.Vector3) {
        this.axis = axis;
        this.vector = vector;
    }
}

const xAxis = new Axis("x", new THREE.Vector3(1, 0, 0));
const yAxis = new Axis("y", new THREE.Vector3(0, 1, 0));
const zAxis = new Axis("z", new THREE.Vector3(0, 0, 1));

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

interface MouseDownInfo {
    clientX: number;
    clientY: number;
    sticker: THREE.Object3D<THREE.Object3DEventMap>;
    clickedPoint: THREE.Vector3
}

export default class Cube {
    size: number
    speedMode: boolean = DEFAULT_SPEED_MODE;

    onCameraCallbacks: Array<(pos: THREE.Vector3) => void> = []
    onMoveCallbacks: Array<(move: string) => void> = []

    inspection: boolean = false

    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls

    boxes: Array<THREE.Mesh> = []

    // since numjs does not support ndarray for non numeric types
    // create a flat array of THREE.Groups and ndarray of cubies indices
    cubies: Array<THREE.Group> = []
    cubieIndices!: nj.NdArray

    mouseDownInfo?: MouseDownInfo;

    defaultPerformMove = true;

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
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false; // disable right mouse button camera panning (side to side movement)
        this.controls.addEventListener('change', () => this.onCameraChange());

        this.init_internal_state();
        this.draw(state);
    }

    init_internal_state() {
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
        this.init_internal_state();
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

    onCamera(callback: (pos: THREE.Vector3) => void) {
        this.onCameraCallbacks.push(callback);
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

    onMove(callback: (move: string) => void) {
        this.onMoveCallbacks.push(callback);
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
        console.log("render")
        this.renderer.render(this.scene, this.camera);
    }

    toggleBoxes() {
        if (this.speedMode) {
            for (const box of this.boxes) {
                box.visible = false;
            }
        } else {
            for (const box of this.boxes) {
                box.visible = true;
            }
        }
    }

    setSpeedMode(speedMode: boolean) {
        if (this.speedMode === speedMode) return; // no change

        this.speedMode = speedMode;
        this.toggleBoxes();
        this.render();
    }

    setSize(newSize: number) {
        this.size = newSize;
        this.init_internal_state();
        this.draw();
    }

    getMesh(color: string) {
        let stickerGeometry;
        if (this.speedMode) {
            stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
        } else {
            stickerGeometry = new THREE.PlaneGeometry(0.93, 0.93);
        }

        let colors = new Map([
            ["R", 0xff1100], // red
            ["O", 0xffa200], // orange
            ["W", 0xffffff], // white
            ["Y", 0xfffb00], // yellow
            ["G", 0x33ff00], // green
            ["B", 0x0800ff]  // blue
        ]);

        const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors.get(color), side: THREE.DoubleSide} );
        const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
        return stickerMesh;
    }

    drawStickers(state: string = "") {
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
                    const mesh = this.getMesh(face_stickers[n * i + j]);
                    mesh.lookAt(faceCenters[face_i]);
                    group.add(mesh);
                    mesh.translateZ(0.5)
                }
            }
        }
    }

    generateCubies() {
        this.boxes = []
        const boxGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        for (const cubie of this.cubies) {
            const box = boxMesh.clone();
            this.boxes.push(box);
            cubie.add(box);
        }
    }

    draw(state?: string) {
        if (!state) {
            state = getDefaultCubeState(this.size);
        }
        // clear the scene
        this.scene.remove.apply(this.scene, this.scene.children);

        this.camera.position.set(0, this.size + this.size / 2 - 1.2, this.size + this.size / 2 + 1)
        this.camera.lookAt(0, 0, 0);

        // visualize the axes
        // X is red, Y is green, Z is blue
        // const axesHelper = new THREE.AxesHelper( 10 );
        // this.scene.add( axesHelper );

        for (const group of this.cubies) {
            this.scene.add(group);
        }

        this.toggleBoxes();

        this.drawStickers(state);
        this.render();
    }

    getAxisRemapping() {
        // camera position might have changed - when resizing the cube
        this.controls.update();

        const angle = this.controls.getAzimuthalAngle()*180/Math.PI;
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
        if (this.controls) {
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

    getLayer(axis: string, index: number) {
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

    rotate_layer(axis: string, index: number, dir: number) {
        if (axis === "y") { dir *= -1; }
        const layer = this.getLayer(axis, index);
        const rotated = nj.rot90(layer, -1 * dir).clone()

        for (let i = 0; i < this.size; ++i) {
            for (let j = 0; j < this.size; ++j) {
                layer.set(i, j, rotated.get(i, j))
            }
        }
    }

    clearGroup() {
    }

    animationForceEnd() {
        // cancel current move animation
        // if previous move animation was still in progress, force it to end
        // this would not work correctly without calling .stop() first
        for (const tween of TWEEN.getAll()) {
            if (tween.isPlaying()) {
                tween.stop();
                tween.end();
            }
        }
    }

    makeMove(move_string: string, send: boolean=true, performMove=this.defaultPerformMove) {
        if (this.inspection && !["x", "x'", "y", "y'", "z", "z'"].includes(move_string)) {
            return;
        }

        const tweens = TWEEN.getAll()
        console.log(tweens, "tweens")

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
        const tween = new TWEEN.Tween(tweenGroup.rotation)
                        .to({[move.axis]: -1 * direction * Math.PI / 2}, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => {
                            removeForRender(this);
                            this.clearGroup();
                            // remove all cubies from group that was used for rotating the cubies
                            // on screen and remove the group from the scene
                            for (var i = tweenGroup.children.length - 1; i >= 0; --i) {
                                this.scene.attach(tweenGroup.children[i]);
                            }
                            this.scene.remove(tweenGroup);
                        })
        tween.start();

        // add cube to render queue
        addForRender(this);
        requestRenderIfNotRequested();
    }

    mouseDown(event: MouseEvent) {
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
            this.mouseDownInfo = undefined;
            return;
        }

        // a sticker was clicked - the user wants to make a move
        // disable camera rotation, so the desired mouse movement does not move the camera
        if (this.controls !== undefined) {
            this.controls.enabled = false;
        }

        const clickedSticker = intersectedStickers[0].object;
        const clickedCoordinates = intersectedStickers[0].point;

        this.mouseDownInfo = {
            clientX: event.clientX,
            clientY: event.clientY,
            sticker: clickedSticker,
            clickedPoint: clickedCoordinates
        }
    }

    mouseUp(event: MouseEvent) {
        // check whether a sticker was clicked on mouseDown event handler
        if (this.mouseDownInfo === undefined) {
            return;
        }

        this.controls.enabled = true;

        // direction of the cursor movement
        const mouseMovementVector = new THREE.Vector2(
            event.clientX - this.mouseDownInfo.clientX,
            event.clientY - this.mouseDownInfo.clientY
        )

        if (mouseMovementVector.length() <= 3) {
            // the mouse movement was very short - possibly just a click
            return;
        }
        const clickedPosition = this.mouseDownInfo.clickedPoint;

        // calculate normal vector to the clicked sticker plane
        const stickerNormal = new THREE.Vector3();
        this.mouseDownInfo.sticker.getWorldDirection(stickerNormal);
        stickerNormal.round();
        // visualize the normal
        // drawLine(this.mouseDownObject.clickedPoint, stickerNormal.clone().add(this.mouseDownObject.clickedPoint), this.scene);

        const orthogonalVectors = getOrtogonalVectors(stickerNormal);
        // visualize the orthogonal vectors
        const startPoint = this.mouseDownInfo.clickedPoint;
        const endPoints = orthogonalVectors.map((vector) => vector.clone().add(startPoint));
        // endPoints.forEach((endPoint) => drawLine(startPoint, endPoint, this.scene));

        const startPointScreen = getScreenCoordinates(startPoint, this.camera);
        const endPointsScreen = endPoints.map((point) => getScreenCoordinates(point, this.camera));
        const screenDirs = endPointsScreen.map((end) => end.sub(startPointScreen));

        // calculate angle to mouseMovenmentVector
        const angles = screenDirs.map((dir) => dir.angleTo(mouseMovementVector)*180/Math.PI);

        // choose the vector closest to mouseMovementVector
        let lowest = 0;
        for (let j = 1; j < 4; ++j) {
            if (angles[j] < angles[lowest]) {
                lowest = j;
            }
        }
        const move_dir = orthogonalVectors[lowest];

        // get rotation axis
        let axisVector;
        let axis;
        for (let baseVec of [xAxis, yAxis, zAxis]) {
            const baseLabel = baseVec.axis;
            const baseVector = baseVec.vector;
            if (baseVector.dot(move_dir) === 0 && baseVector.dot(stickerNormal) === 0) {
                axisVector = baseVector;
                axis = baseLabel;
                break;
            }
        }

        // get clicked sticker position along the rotations axis and round to nearest .5
        // HERE, TAKE THE PARENT POSITION, NOT THE STICKER - todo

        const componentIndex = axis === "x" ? 0 :  axis === "y" ? 1 :  2
        let coord = this.mouseDownInfo.sticker.parent?.position.getComponent(componentIndex);
        if (!coord) return;
        coord = Math.round(coord * 2) / 2;

        // exception fro middle layer
        const flipped = coord < 0 || (axis === "x" && coord === 0);
        const face = getFace(axis as any, flipped, coord === 0);
        coord = Math.abs(coord);

        // triple product calculation
        // does the vector rotate around the axis in a clockwise or anticlockwise direction?
        // positive determinant - anticlockwise
        // negative determinant - clockwise
        const matrix = new THREE.Matrix3();
        matrix.set(
            (axisVector as any).x,  (axisVector as any).y,  (axisVector as any).z,
            clickedPosition.x, clickedPosition.y, clickedPosition.z,
            move_dir.x,      move_dir.y,      move_dir.z
        )
        const determinant = matrix.determinant();

        let rotationSign = 1;
        if (determinant > 0) {
            rotationSign *= -1;
        }
        if (flipped) {
            rotationSign *= -1;
        }

        const offset = -(this.size - 1) / 2;
        // TODO fix middle layers moves
        // TODO M on 4x4 does not work
        const moveObj = new LayerMove(face as any, axis as any, flipped, Math.abs(coord + offset) + 1, rotationSign, false, false);
        this.makeMove(moveObj.toString());
    }
}