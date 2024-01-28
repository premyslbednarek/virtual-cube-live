import * as THREE from './three.module.js'
import * as TWEEN from './tween.module.js'
import { OrbitControls } from './OrbitControls.js';
import { sendMove, sendCamera } from './websocket.js';
import { startTimer, stopTimer, isStarted, requestRenderIfNotRequested } from './main.js';
import { getOrtogonalVectors, getScreenCoordinates, degToRad, drawLine } from './utils.js';

const xAxis = ["x", new THREE.Vector3(1, 0, 0)];
const yAxis = ["y", new THREE.Vector3(0, 1, 0)];
const zAxis = ["z", new THREE.Vector3(0, 0, 1)];

class Cube {
    constructor(layers, canvas) {
        this.layers = layers;
        this.scene = new THREE.Scene();
        this.canvas = canvas;
        this.camera = new THREE.PerspectiveCamera(
            75, 
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({antialias: true, canvas});
        this.speedMode = true;
        this.tween;

        // group for rotating objects together
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.stickers = [];

        this.resizeCanvas();
        window.addEventListener("resize", () => { this.resizeCanvas(); }, false);

        this.draw();
        this.solved = true;
        this.needsSolvedCheck = false;

        this.genMoveToLayer();
    }

    genMoveToLayer() {
        // moveToLayer[move in standard notation] = [layer's axis of rotation, layer index]
        // layer indices are 0-indexed starting from the 'most negative' layer on given axis
        // on standard 3x3 cube - L has index 0, M has index 1, R has index 2
        const moveToLayer = new Map();
        moveToLayer.set("L", ["x", 0]);
        moveToLayer.set("D", ["y", 0]);
        moveToLayer.set("B", ["z", 0]);
        moveToLayer.set("R", ["x", this.layers - 1]);
        moveToLayer.set("U", ["y", this.layers - 1]);
        moveToLayer.set("F", ["z", this.layers - 1]);

        // flipped layers - first n layers on given axis turn in other direction
        // flipped["x"] = 2 means that when we turn the first two layers on the x axis (L and M)
        // clockwise, they turn in the other direction that the other layers on that axis (R) 
        const flippedN = Math.floor(this.layers / 2);
        const flipped = new THREE.Vector3(flippedN, flippedN, flippedN);

        let innerLayers = this.layers - 2;
        // even-layered cubes do not have the middle layer (M/E/S)
        if (this.layers % 2 == 1) {
            const middleIndex = Math.floor((this.layers - 1) / 2);
            --innerLayers;
            moveToLayer.set("M", ["x", middleIndex]);
            moveToLayer.set("E", ["y", middleIndex]);
            moveToLayer.set("S", ["z", middleIndex]);
            ++flipped["x"]; // M turns like L
        }

        // generate mapping for layers such as 2R, 3R etc.
        for (let i = 1; i <= innerLayers / 2; ++i) {
            const prefix = i + 1 + "";
            moveToLayer.set(prefix + "L", ["x", i]);
            moveToLayer.set(prefix + "D", ["y", i]);
            moveToLayer.set(prefix + "B", ["z", i]);
            moveToLayer.set(prefix + "R", ["x", this.layers - i - 1]);
            moveToLayer.set(prefix + "U", ["y", this.layers - i - 1]);
            moveToLayer.set(prefix + "F", ["z", this.layers - i - 1]);
        }

        // create inverted mapping
        // layerToMove[axis][layer index] = [move in standard notation]
        const layerToMove = new Map();
        layerToMove.set("x", new Map());
        layerToMove.set("y", new Map());
        layerToMove.set("z", new Map());
        // Map.prototype.forEach callback swaps key and value
        moveToLayer.forEach(function(value, key) {
            const axis = value[0];
            const index = value[1];
            layerToMove.get(axis).set(index, key);
        });

        this.moveToLayer = moveToLayer;
        this.layerToMove = layerToMove;
        this.flipped = flipped;
        this.firstLayerPosition = -(this.layers - 1) / 2;
    }

    resizeCanvas() {
        const canvas = this.renderer.domElement;
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix(); // must be called after changing camera's properties
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }


    cleanGroup() {
        for (var i = this.group.children.length - 1; i >= 0; --i) {
            this.scene.attach(this.group.children[i]);
        }
        this.scene.remove(this.group);
    }

    getStickerFace(sticker) {
        const stickerPosition = this.layers / 2 + 0.01;
        if (Math.abs(stickerPosition - sticker.position.x) < 0.1) return "R";
        if (Math.abs(stickerPosition - sticker.position.y) < 0.1) return "U";
        if (Math.abs(stickerPosition - sticker.position.z) < 0.1) return "F";
        if (Math.abs(-stickerPosition - sticker.position.x) < 0.1) return "L";
        if (Math.abs(-stickerPosition - sticker.position.y) < 0.1) return "D";
        if (Math.abs(-stickerPosition - sticker.position.z) < 0.1) return "B";
    }

    isSolved() {
        if (!this.needsSolvedCheck) return this.solved;
        this.needsSolvedCheck = false;
        this.cleanGroup();
        const colorToFace = new Map();
        for (const sticker of this.stickers) {
            const color = sticker.material.color.getHex();
            const face = this.getStickerFace(sticker);
            if (colorToFace.has(color)) {
                if (colorToFace.get(color) != face) {
                    this.solved = false;
                    return false;
                }
            } else {
                colorToFace.set(color, face);
            }
        }
        // console.log("Cube solved!");
        this.solved = true;
        return true;
    }

    toggleSpeedMode() {
        this.speedMode = !this.speedMode;
        this.draw();
    }

    changeLayers(newLayers) {
        this.layers = parseInt(newLayers);
        this.draw();
        this.genMoveToLayer();
    }

    drawStickers() {
        const centerOffset = -(this.layers - 1) / 2;

        let stickerGeometry;
        if (this.speedMode) {
            stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
        } else {
            stickerGeometry = new THREE.PlaneGeometry(0.93, 0.93);
        }

        let faceCenters = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        let colors = [
            0xff1100, // red
            0xffa200, // orange
            0xffffff, // white
            0xfffb00, // yellow
            0x33ff00, // green
            0x0800ff  // blue
        ];

        this.stickers = [];
        for (let n = 0; n < 6; ++n) {
            const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors[n], side: THREE.DoubleSide} );
            const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
            for (let i = 0; i < this.layers; ++i) {
                for (let j = 0; j < this.layers; ++j) {
                    let sticker = stickerMesh.clone();
                    sticker.lookAt(faceCenters[n]);
                    sticker.translateZ(-centerOffset + 0.5 + 0.001);
                    sticker.translateX(centerOffset + i);
                    sticker.translateY(centerOffset + j);
                    sticker.isSticker = true;
                    // var stickerAxis = new THREE.AxesHelper(2);
                    // sticker.add(stickerAxis);
                    this.stickers.push(sticker);
                    this.scene.add(sticker);
                }
            }
        }
    }

    drawCubies() {
        const centerOffset = -(this.layers - 1) / 2;
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        for (let i = 0; i < this.layers; ++i) {
            for (let j = 0; j < this.layers; ++j) {
                for (let k = 0; k < this.layers; ++k) {
                    const cubie = boxMesh.clone();
                    cubie.position.set(i + centerOffset, j + centerOffset, k + centerOffset);
                    this.scene.add(cubie);
                }
            }
        }
    }

    draw() {
        // clear scene
        this.scene.remove.apply(this.scene, this.scene.children);

        this.camera.position.set(0, this.layers + this.layers / 2 - 1.2, this.layers + this.layers / 2 + 1)
        this.camera.lookAt(0, 0, 0);

        // visualize the axes
        // X is red, Y is green, Z is blue
        const axesHelper = new THREE.AxesHelper( 10 );
        this.scene.add( axesHelper );

        if (!this.speedMode) {
            this.drawCubies();
        }

        this.drawStickers();
        this.render();
    }

    makeMove(move, send=true, scramble=false) {  
        if (send) {
            sendMove(move);
        }

        let anticlockwise = false;
        if (move[move.length - 1] == "'") {
            anticlockwise = true;
            move = move.slice(0, -1); // remove ' from the move
        }
        let isWideMove = false;
        if (move[move.length - 1] == "w") {
            isWideMove = true;
            move = move.slice(0, -1);
        }

        const rotations = ["x", "x'", "y", "y'", "z", "z'"];
        // move is rotation
        if (rotations.includes(move)) {
            const args = [-Infinity, Infinity, move[0], -1];
            if (anticlockwise) args[3] = 1;
            this.rotateGroupGen(...args);
            return;
        }

        // move is not a rotation
        const [axis, index] = this.moveToLayer.get(move);
        let lowerBound = this.firstLayerPosition + index - 0.25;
        let upperBound = this.firstLayerPosition + index + 0.25;
        if (index < this.flipped[axis]) anticlockwise = !anticlockwise;
        if (index == 0) {
            lowerBound -= 1;
            if (isWideMove) upperBound += 1;
        } else if (index == this.layers - 1) {
            upperBound += 1;
            if (isWideMove) lowerBound -= 1;
        }
        const args = [lowerBound, upperBound, axis, -1];
        if (anticlockwise) args[3] = 1;
        this.rotateGroupGen(...args);
    }

    rotateGroupGen(low, high, axis, mult) {
        const scene = this.scene;
        
        // console.log("rotation started", low, high, axis, mult);
        if (this.tween && this.tween.isPlaying()) {
            this.tween.stop(); // this would not work without stopping it first (+-2h debugging)
            this.tween.end();
        }

        this.cleanGroup();
        this.needsSolvedCheck = true;
        
        // construct new group
        this.group = new THREE.Group();
        for (var i = scene.children.length - 1; i >= 0; --i) {
            if (scene.children[i].type == "AxesHelper") continue;
            if (low <= scene.children[i].position[axis] && scene.children[i].position[axis] <= high) {
                this.group.attach(scene.children[i]);
            }
        }
        scene.add(this.group);

        // tween
        // [axis] - this is the usage of "computed property name" introduced in ES6
        this.tween = new TWEEN.Tween(this.group.rotation)
                        .to({[axis]: mult * Math.PI / 2}, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => { this.isSolved(); })
                        .start();
        requestRenderIfNotRequested();
    }
}

class MovableCube extends Cube {
    constructor(layers, canvas) {
        super(layers, canvas);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false; // disable moving the camera with right click
        this.controls.minAzimuthAngle = degToRad(-35);
        this.controls.maxAzimuthAngle = degToRad(35);
        this.controls.minPolarAngle = degToRad(60);
        this.controls.maxPolarAngle = degToRad(120);
        this.controls.update();
        this.controls.addEventListener('change', () => this.render());
        this.controls.addEventListener('end', () => this.onCameraEnd());
        this.controls.addEventListener('change', () => this.onCameraEnd());

    }

    isSolved() {
        super.isSolved();
        if (isStarted() && this.solved) stopTimer();
    }

    onCameraEnd() {
        sendCamera({position: this.camera.position, rotation: this.camera.rotation});
    }

    makeMove(move, send=true, scramble=false) {
        const rotations = new Set(["y", "y'", "x", "x'", "z", "z'"]);
        if (!scramble && !rotations.has(move) && !isStarted()) { startTimer()};
        super.makeMove(move, send);

    }

    mouseDown(event) {
        // calculate pointer position in NDC - normalized device coordinates
        // in NDC, bottom left corner is [-1, -1], top right is [1, 1]
        const pointer = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            - (event.clientY / window.innerHeight) * 2 + 1
        )
        
        // find stickers under the pointer
        // note that it is possible to click stickers, that cannot be directly 
        // seen from our point of view (e.g. stickers on the back face)
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this.camera);
        const intersectedStickers = raycaster.intersectObjects(this.stickers);

        if (intersectedStickers.length == 0) {
            this.mouseDownObject = undefined;
            return;
        }

        // a sticker was clicked - the user wants to make a move
        // disable camera rotation, so the desired mouse movement does not move the camera
        this.controls.enabled = false;

        const clickedSticker = intersectedStickers[0].object;
        const clickedCoordinates = intersectedStickers[0].point;

        this.mouseDownObject = {
            clientX: event.clientX,
            clientY: event.clientY,
            sticker: clickedSticker,
            clickedPoint: clickedCoordinates
        }
    }

    mouseUp(event) {
        // check whether a sticker was clicked on mouseDown event handler
        if (this.mouseDownObject == undefined) {
            return;
        }

        this.controls.enabled = true;

        // direction of the cursor movement
        const mouseMovementVector = new THREE.Vector2(
            event.clientX - this.mouseDownObject.clientX,
            event.clientY - this.mouseDownObject.clientY
        )
        
        if (mouseMovementVector.length() <= 3) {
            // the mouse movement was very short - possibly just a click
            return;
        }
        const clickedPosition = this.mouseDownObject.clickedPoint;

        // calculate normal vector to the clicked sticker plane
        const stickerNormal = new THREE.Vector3();
        this.mouseDownObject.sticker.getWorldDirection(stickerNormal);
        stickerNormal.round();
        // visualize the normal
        // drawLine(this.mouseDownObject.clickedPoint, stickerNormal.clone().add(this.mouseDownObject.clickedPoint), this.scene);

        const orthogonalVectors = getOrtogonalVectors(stickerNormal);
        // visualize the orthogonal vectors
        const startPoint = this.mouseDownObject.clickedPoint;
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
        let rotateAround;
        let rotateAroundLabel;
        for (let [label, axis] of [xAxis, yAxis, zAxis]) {
            if (axis.dot(move_dir) == 0 && axis.dot(stickerNormal) == 0) {
                rotateAround = axis;
                rotateAroundLabel = label;
                break;
            }
        }
        const layerIndex = Math.round(-this.firstLayerPosition + this.mouseDownObject.sticker.position[rotateAroundLabel]);

        // rotated layer in standard notation
        const layerName = this.layerToMove.get(rotateAroundLabel).get(layerIndex);
        let dir = 1;
        if (layerIndex < this.flipped[rotateAroundLabel]) {
            dir = -1;
        };

        // triple product calculation
        // does the vector rotate around the axis in a clockwise or anticlockwise direction?
        // positive determinant - anticlockwise
        // negative determinant - clockwise
        const matrix = new THREE.Matrix3();
        matrix.set(
            rotateAround.x,  rotateAround.y,  rotateAround.z,
            clickedPosition.x, clickedPosition.y, clickedPosition.z,
            move_dir.x,      move_dir.y,      move_dir.z
        )
        const determinant = matrix.determinant();

        let move = layerName;
        // move was anticlockwise
        if (determinant > 0) dir *= -1;
        if (dir == -1) move += "'";
        this.makeMove(move);
    }
}

export { Cube, MovableCube };