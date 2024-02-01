import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
import { OrbitControls } from './libs/OrbitControls.js';
import { sendMove, sendCamera } from './websocket.js';
import { startTimer, stopTimer, isStarted, requestRenderIfNotRequested } from './main.js';
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

    parseMove(move) {
        // move examples: 2R', Rw', F', U
        let face, layer = 0, rotationSign = 1, wide = false;

        if (move[move.length - 1] == "'") {
            rotationSign = -1; // anticlockwise move
            move = move.slice(0, -1); // remove ' from string
        }
        if (move[move.length - 1] == "w") {
            wide = true;
            move = move.slice(0, -1);
        }

        face = move[move.length - 1];
        if (move.length == 2) {
            layer = parseInt(move[0]) - 1; // layers are 0 indexed
        }
        if (face == "M" || face == "S" || face == "E") {
            layer = Math.floor(this.layers / 2);
        }
        return {
            face: face,
            layer: layer,
            wide: wide,
            rotationSign: rotationSign,
        }
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

        const moveObj = this.parseMove(move);

        // check whether a move is a rotation
        if (["x", "x'", "y", "y'", "z", "z'"].includes(move)) {
            this.rotateGroupGen([-Infinity, Infinity, move[0], moveObj.rotationSign]);
            return;
        }

        const [axis, axisSign] = faceToAxis.get(moveObj.face);
        
        let high = Math.abs(this.firstLayerPosition) - moveObj.layer + 0.25;
        let low = Math.abs(this.firstLayerPosition) - moveObj.layer - 0.25;

        // outer layer - rotate outer stickers
        if (moveObj.layer == 0) high += 1;

        // wide move - move two outer layers
        if (moveObj.wide) {
            low -= 1;
        }

        if (axisSign == -1) {
            [high, low] = [-low, -high];
        }

        this.rotateGroupGen(low, high, axis, axisSign * moveObj.rotationSign);

    }

    // makeMove(move, send=true, scramble=false) {  
    //     if (send) {
    //         sendMove(move);
    //     }

    //     let anticlockwise = false;
    //     if (move[move.length - 1] == "'") {
    //         anticlockwise = true;
    //         move = move.slice(0, -1); // remove ' from the move
    //     }
    //     let isWideMove = false;
    //     if (move[move.length - 1] == "w") {
    //         isWideMove = true;
    //         move = move.slice(0, -1);
    //     }

    //     const rotations = ["x", "x'", "y", "y'", "z", "z'"];
    //     // move is rotation
    //     if (rotations.includes(move)) {
    //         const args = [-Infinity, Infinity, move[0], -1];
    //         if (anticlockwise) args[3] = 1;
    //         this.rotateGroupGen(...args);
    //         return;
    //     }

    //     // move is not a rotation
    //     const [axis, index] = this.moveToLayer.get(move);
    //     let lowerBound = this.firstLayerPosition + index - 0.25;
    //     let upperBound = this.firstLayerPosition + index + 0.25;
    //     if (index < this.flipped[axis]) anticlockwise = !anticlockwise;
    //     if (index == 0) {
    //         lowerBound -= 1;
    //         if (isWideMove) upperBound += 1;
    //     } else if (index == this.layers - 1) {
    //         upperBound += 1;
    //         if (isWideMove) lowerBound -= 1;
    //     }
    //     const args = [lowerBound, upperBound, axis, -1];
    //     if (anticlockwise) args[3] = 1;
    //     this.rotateGroupGen(...args);
    // }

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

    }

    isSolved() {
        super.isSolved();
        if (isStarted() && this.solved) stopTimer();
    }

    onCameraEnd() {
        sendCamera({position: this.camera.position, rotation: this.camera.rotation});
    }

    makeKeyboardMove(move) {
        // needs to be worked on
        this.controls.update();
        // camera rotation around the y axis <-180, 180> deg
        const angle = this.controls.getAzimuthalAngle()*180/Math.PI;

        const moveObj = this.parseMove(move);
        let newRotation = moveObj.rotationSign;

        let oldAxis, oldAxisSign;
        const isRotation = ["y", "y'", "x", "x'", "z", "z'"].includes(move);
        if (isRotation) {
            oldAxis = move[0];
            oldAxisSign = 1;
            if (move.length == 2) {
                oldAxisSign = -1;
            }
        } else {
            [oldAxis, oldAxisSign] = faceToAxis.get(moveObj.face);
        }

        if (oldAxisSign == -1) {
            newRotation *= 1;
        }

        if (oldAxis == "y") {
            this.makeMove(move);
            return;
        }

        let newAxis = oldAxis;
        let negateSign = false;
        if (-45 <= angle && angle <= 45) {
            // nothing
        } else if (45 < angle && angle < 135) {
            // x = -z; z = x;
            if (oldAxis == "x") {
                newAxis = "z";
                negateSign = true;
            } else if (oldAxis == "z") {
                newAxis = "x";
            }
        } else if (135 < angle || angle < -135) {
            // x = -x; z = -z;
            negateSign = true;
        } else {
            // x = z; z = -x;
            if (oldAxis == "z") {
                newAxis = "x";
                negateSign = true;
            } else if (oldAxis == "x"){
                newAxis = "z";
            }
        }

        let coord = oldAxisSign;
        if (moveObj.face == 'M' || moveObj.face == 'S' || moveObj.face == 'E') {
            coord = 0;
        }

        let newAxisSign = oldAxisSign;
        if (negateSign)  {
            newAxisSign *= -1;
            coord = -coord;
        }

        if (newAxisSign) {
            newRotation *= -1;
        }

        let newMove;
        if (isRotation) {
            newMove = newAxis;
        } else {
            newMove = getFace(newAxis, coord);
        }

        let finalMove = "";
        if (coord != 0 && moveObj.layer >= 1) {
            finalMove += moveObj.layer + 1;
        }

        finalMove += newMove;
        if (moveObj.wide) {
            finalMove += "w";
        }
        if (newRotation == 1) {
            finalMove += "'";
        }
        this.makeMove(finalMove);
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
        let axisSign = faceToAxis.get(face)[1];

        // distance from outer layers position
        const layer = Math.abs(this.firstLayerPosition) - Math.abs(coord);

        if (axisSign == -1) {
            axisVector = axisVector.clone().negate();
        }

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

        let outputMove = "";

        // for inner layers other than middle layers add prefix
        if (coord != 0 && layer >= 1) {
            outputMove += layer + 1;
        }

        outputMove += face;
        
        if (determinant > 0) {
            outputMove += "'";
        }

        this.makeMove(outputMove);
    }
}

export { Cube, MovableCube };