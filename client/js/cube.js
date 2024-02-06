import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
import { OrbitControls } from './libs/OrbitControls.js';
import { sendMove, sendCamera, sendReset } from './websocket.js';
import { requestRenderIfNotRequested } from './main.js';
import { Timer, startTimer, stopTimer, isStarted } from './timer.js';
import { getOrtogonalVectors, getScreenCoordinates, degToRad, drawLine } from './utils.js';

const xAxis = ["x", new THREE.Vector3(1, 0, 0)];
const yAxis = ["y", new THREE.Vector3(0, 1, 0)];
const zAxis = ["z", new THREE.Vector3(0, 0, 1)];

// values are [axis, axisSign]
const faceToAxis = new Map();
faceToAxis.set("R", ["x",  1]);
faceToAxis.set("U", ["y",  1]);
faceToAxis.set("F", ["z",  1]);
faceToAxis.set("L", ["x", -1]);
faceToAxis.set("D", ["y", -1]);
faceToAxis.set("B", ["z", -1]);
faceToAxis.set("M", ["x", -1]);
faceToAxis.set("S", ["z",  1]);
faceToAxis.set("E", ["y",  1]);

const flippedRotation = new Map();
for (const face of "RUFSE") {
    flippedRotation.set(face, false);
}
for (const face of "LDBM") {
    flippedRotation.set(face, true);
}

function isRotation(move) {
    return ["x", "x'", "y", "y'", "z", "z'"].includes(move);
}

function getFace(axis, coord) {
    if (coord == 0) {
        switch (axis) {
            case "x": return "M";
            case "y": return "E";
            case "z": return "S";
        }
    }
    if (coord > 0) {
        switch (axis) {
            case "x": return "R";
            case "y": return "U";
            case "z": return "F";
        }
    }

    // coord < 0
    switch (axis) {
        case "x": return "L";
        case "y": return "D";
        case "z": return "B";
    }
}

class Move {
    constructor(axis, rotationSign) {
        this.axis = axis;
        this.rotationSign = rotationSign;
    }
}

class LayerMove extends Move {
    constructor(face, axis, flippedRotation, offset, coord, rotationSign, wide) {
        super(axis, rotationSign);
        this.face = face;
        this.offset = offset;
        this.coord = coord;
        this.wide = wide;
        this.flippedRotation = flippedRotation;
    }

    toString() {
        let string = "";
        if (this.offset > 0) string += this.offset + 1;
        string += this.face;
        if (this.wide) string += "w";

        if ((this.flippedRotation && this.rotationSign == 1) ||
            (!this.flippedRotation && this.rotationSign == -1)) {
                string += "'"
        };

        return string;
    }

    changeAxis(newAxis, negateAxis) {
        this.axis = newAxis;

        if (negateAxis) {
            this.coord = -this.coord;
            this.rotationSign *= -1;
        }

        this.face = getFace(this.axis, this.coord);
        this.flippedRotation = flippedRotation.get(this.face);

    }
}

class Rotation extends Move {
    constructor(axis, rotationSign) {
        super(axis, rotationSign);
    }

    toString() {
        let string = this.axis;
        if (this.rotationSign == -1) {
            string += "'";
        }
        return string;
    }

    changeAxis(newAxis, negateAxis) {
        this.axis = newAxis;
        if (negateAxis) {
            this.rotationSign *= -1;
        }
    }
}


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

        this.firstLayerPosition = -(this.layers - 1) / 2;
    }

    stringToMove(string) {
        const rotation = isRotation(string);
        let rotationDir = 1;

        // if last character in string is ', the move is anticlockwise
        if (string[string.length -1] == "'") {
            rotationDir *= -1;
            // remove ' from string
            string = string.slice(0, -1);
        }

        if (isRotation(string)) {
            const axis = string[0];
            return new Rotation(axis, rotationDir);
        }

        let wide = false;
        if (string[string.length - 1] == "w") {
            wide = true;
            string = string.slice(0, -1);
        }

        const face = string[string.length - 1];
        const isMiddle = face == "M" || face == "E" || face == "S";

        let [axis, flippedAxis] = faceToAxis.get(face);
        flippedAxis = flippedAxis == -1;

        // distance of the layer from the outer layer
        const layerOffset = (string.length == 2) ? parseInt(string[0]) - 1 : 0;
        let coord = !isMiddle && !rotation ? (this.layers - 1) / 2 : 0;
        coord -= layerOffset; // 0 for middle layers
        if (flippedAxis) {
            rotationDir *= -1;
            coord = -coord;
        }

        return new LayerMove(face, axis, flippedAxis, layerOffset, coord, rotationDir, wide);
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
        this.firstLayerPosition = -(this.layers - 1) / 2;
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

    makeMove(move, send=true) {
        if (send) {
            sendMove(move);
        }

        const moveObj = this.stringToMove(move);

        // check whether a move is a rotation
        if (isRotation(move)) {
            this.rotateGroupGen(-Infinity, Infinity, moveObj.axis, moveObj.rotationSign);
            return;
        }
        
        let high = moveObj.coord + 0.25;
        let low = moveObj.coord - 0.25;

        // outer layer - rotate outer stickers
        if (Math.abs(moveObj.coord) == Math.abs(this.firstLayerPosition)) {
            if (high > 0) high += 1;
            else low -= 1;
        }

        // wide move - move two outer layers
        if (moveObj.wide) {
            if (high > 0) low -= 1;
            else high += 1;
        }
        
        this.rotateGroupGen(low, high, moveObj.axis, moveObj.rotationSign);
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
                        .to({[axis]: -1 * mult * Math.PI / 2}, 200)
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
        // this.controls.minAzimuthAngle = degToRad(-35);
        // this.controls.maxAzimuthAngle = degToRad(35);
        this.controls.minPolarAngle = degToRad(60);
        this.controls.maxPolarAngle = degToRad(120);
        this.controls.update();
        this.controls.addEventListener('change', () => this.render());
        this.controls.addEventListener('end', () => this.onCameraEnd());
        this.controls.addEventListener('change', () => this.onCameraEnd());
        this.timer = new Timer(document.getElementById("timer"));
    }

    isSolved() {
        super.isSolved();
        if (this.timer.started && this.solved) this.timer.stop();
    }

    scramble(scramble) {
        for (const move of scramble) {
            super.makeMove(move);
        }
        this.timer.startInspection();
    }

    makeMove(move, send=true, scramble=false) {
        if (!scramble && !isRotation(move) && this.timer.inspection) { this.timer.start()};
        super.makeMove(move, send);

    }

    onCameraEnd() {
        sendCamera({position: this.camera.position, rotation: this.camera.rotation});
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

    makeKeyboardMove(move) {
        const remapping = this.getAxisRemapping();
        const moveObj = this.stringToMove(move);
        
        if (remapping.has(moveObj.axis)) {
            const [newAxis, negateAxis] = remapping.get(moveObj.axis);
            moveObj.changeAxis(newAxis, negateAxis);
        }
        
        const newMove = moveObj.toString();
        this.makeMove(newMove);
    }

    mouseDown(event) {
        // calculate pointer position in NDC - normalized device coordinates
        // in NDC, canvas bottom left corner is [-1, -1], top right is [1, 1]
        const pointer = new THREE.Vector2(
            (event.clientX / this.canvas.clientWidth) * 2 - 1,
            - (event.clientY / this.canvas.clientHeight) * 2 + 1
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
        let axisVector;
        let axis;
        for (let [baseLabel, baseVector] of [xAxis, yAxis, zAxis]) {
            if (baseVector.dot(move_dir) == 0 && baseVector.dot(stickerNormal) == 0) {
                axisVector = baseVector;
                axis = baseLabel;
                break;
            }
        }

        // get clicked sticker position along the rotations axis and round to nearest .5
        let coord = this.mouseDownObject.sticker.position[axis];
        coord = Math.round(coord * 2) / 2; 

        const face = getFace(axis, coord);
        const flipped = flippedRotation.get(face);

        // distance from outer layers position
        const offset = coord == 0 ? 0 : Math.abs(this.firstLayerPosition) - Math.abs(coord);

        // triple product calculation
        // does the vector rotate around the axis in a clockwise or anticlockwise direction?
        // positive determinant - anticlockwise
        // negative determinant - clockwise
        const matrix = new THREE.Matrix3();
        matrix.set(
            axisVector.x,  axisVector.y,  axisVector.z,
            clickedPosition.x, clickedPosition.y, clickedPosition.z,
            move_dir.x,      move_dir.y,      move_dir.z
        )
        const determinant = matrix.determinant();

        let rotationSign = 1;
        if (determinant > 0) {
            rotationSign *= -1;
        }

        const moveObj = new LayerMove(face, axis, flipped, offset, coord, rotationSign, false);
        this.makeMove(moveObj.toString());
    }

    reset() {
        if (this.timer.started) {
            this.timer.stop(false); // do not add time into times
        }
        this.draw();
        sendReset();
    }
}

export { Cube, MovableCube };