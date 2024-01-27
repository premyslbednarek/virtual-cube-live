import * as THREE from './three.module.js'
import { Vector3 } from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { sendMove } from './websocket.js';
import { Tween, Easing } from './tween.module.js';
import { startTimer, stopTimer, isStarted } from './main.js';
import { getOrtogonalVectors, getScreenCoordinates } from './utils.js';
import { drawLine } from './main.js';

const xAxis = ["x", new THREE.Vector3(1, 0, 0)];
const yAxis = ["y", new THREE.Vector3(0, 1, 0)];
const zAxis = ["z", new THREE.Vector3(0, 0, 1)];
const xTurning = 0.25;
const yTurning = -0.25;
const zTurning = -0.25;

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
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.keyMap = new Map();
        this.stickers = [];

        console.log(`Created a ${layers}x${layers} cube`);
        this.resizeCanvas();
        document.addEventListener("resize", () => { this.resizeCanvas(); }, false);
        this.draw();
        this.solved = true;
        this.needsSolvedCheck = false;
        this.faceName = {
            x: {
                "-1": "L",
                "0": "M",
                "1": "R"
            },
            y: {
                "-1": "D",
                "0": "E",
                "1": "U"
            },
            z: {
                "-1": "B",
                "0": "S",
                "1": "F"
            }
        }
        this.faceToRotationAxis = new Map();
        this.faceToRotationAxis.set("R", new Vector3(1, 0, 0));
        this.faceToRotationAxis.set("L", new Vector3(-1, 0, 0));
        this.faceToRotationAxis.set("U", new Vector3(0, 1, 0));
        this.faceToRotationAxis.set("D", new Vector3(0, -1, 0));
        this.faceToRotationAxis.set("F", new Vector3(0, 0, 1));
        this.faceToRotationAxis.set("B", new Vector3(0, 0, -1));
        this.faceToRotationAxis.set("M", new Vector3(-1, 0, 0)); // middle, rotation as L
        this.faceToRotationAxis.set("E", new Vector3(0, -1, 0)); // equator, rotation as D
        this.faceToRotationAxis.set("S", new Vector3(0, 0, 1)); // standing, rotation as F
    }

    resizeCanvas() {
        const canvas = this.renderer.domElement;
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix(); // must be called after changing camera's properties
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
        // this.generateKeymap();
    }

    getClickedAxis(pos) {
        const stickerPosition = this.layers / 2 + 0.01;
        if (Math.abs(stickerPosition - Math.abs(pos.x)) < 0.1) return "x";
        if (Math.abs(stickerPosition - Math.abs(pos.y)) < 0.1) return "y";
        if (Math.abs(stickerPosition - Math.abs(pos.z)) < 0.1) return "z";
    }

    draw() {
        const scene = this.scene;
        var centerOffset = -(this.layers - 1) / 2;
        // clear scene
        scene.remove.apply(scene, scene.children);
        this.camera.position.set(0, this.layers + this.layers / 2 + 1, this.layers + this.layers / 2 + 1)
        this.camera.lookAt(0, 0, 0);
        // visualize the axes
        // X is red, Y is green, Z is blue
        const axesHelper = new THREE.AxesHelper( 10 );
        scene.add( axesHelper );

        if (!this.speedMode) {
            const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
            const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
            const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            for (let i = 0; i < this.layers; ++i) {
                for (let j = 0; j < this.layers; ++j) {
                    for (let k = 0; k < this.layers; ++k) {
                        const cubie = boxMesh.clone();
                        cubie.position.set(i + centerOffset, j + centerOffset, k + centerOffset);
                        scene.add(cubie);
                    }
                }
            }
        }

        var stickerGeometry;
        if (this.speedMode) {
            stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
        } else {
            stickerGeometry = new THREE.PlaneGeometry(0.93, 0.93);
        }

        let faceCenters = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
        let colors = [0xffa200, 0xff1100, 0xffffff, 0xfffb00, 0x33ff00, 0x0800ff];

        this.stickers = [];
        for (let n = 0; n < 6; ++n) {
            for (let i = 0; i < this.layers; ++i) {
                for (let j = 0; j < this.layers; ++j) {
                    const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors[n], side: THREE.DoubleSide} );
                    const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
                    // Mesh.clone() does not clone the material - it has to be copied by hand
                    // https://github.com/mrdoob/three.js/issues/14223 
                    let sticker = stickerMesh.clone();
                    sticker.lookAt(faceCenters[n]);
                    sticker.translateZ(-centerOffset + 0.5 + 0.001);
                    sticker.translateX(centerOffset + i);
                    sticker.translateY(centerOffset + j);
                    sticker.isSticker = true;
                    // var stickerAxis = new THREE.AxesHelper(2);
                    // sticker.add(stickerAxis);
                    this.stickers.push(sticker);
                    scene.add(sticker);
                }
            }
        }
    }

    makeMove(move, send=true, scramble=false) {  
        const lowerBound = (this.layers / 2) - 1;
        const keyMap = this.keyMap;
        keyMap.clear(); // remove all key-value pairs

        keyMap.set("U", [lowerBound, 20, "y", -1]); // U
        keyMap.set("Uw", [lowerBound-1, 20, "y", -1]); // Uw = U wide - two upper layers
        keyMap.set("U'", [lowerBound, 20, "y", 1]);  // U'
        keyMap.set("Uw'", [lowerBound-1, 20, "y", 1]);  // Uw'
        keyMap.set("R", [lowerBound, 20, "x", -1]); // R
        keyMap.set("Rw", [lowerBound-1, 20, "x", -1]); // Rw
        keyMap.set("R'", [lowerBound, 20, "x", 1]);  // R'
        keyMap.set("Rw'", [lowerBound-1, 20, "x", 1]);  // Rw'
        keyMap.set("x'", [-20, 20, "x", 1]); // x'
        keyMap.set("x'", [-20, 20, "x", 1]); // x'
        keyMap.set("x", [-20, 20, "x", -1]); // x
        keyMap.set("x", [-20, 20, "x", -1]); // x
        keyMap.set("L", [-20, -lowerBound, "x", 1]); // L
        keyMap.set("M", [-0.5, 0.5, "x", 1]); // L
        keyMap.set("M'", [-0.5, 0.5, "x", -1]); // L
        keyMap.set("Lw", [-20, -lowerBound+1, "x", 1]); // Lw
        keyMap.set("L'", [-20, -lowerBound, "x", -1]);  // L'
        keyMap.set("Lw'", [-20, -lowerBound+1, "x", -1]);  // Lw'
        keyMap.set("F", [lowerBound, 20, "z", -1]); // F
        keyMap.set("S", [-0.5, 0.5, "z", -1]); // D'
        keyMap.set("F'", [lowerBound, 20, "z", 1]);  // F'
        keyMap.set("S'", [-0.5, 0.5, "z", 1]);  // F'
        keyMap.set("D'", [-20, -lowerBound, "y", -1]); // D'
        keyMap.set("E'", [-0.5, 0.5, "y", -1]); // D'
        keyMap.set("D", [-20, -lowerBound, "y", 1]);  // D
        keyMap.set("E", [-0.5, 0.5, "y", 1]);  // D
        keyMap.set("y", [-20, 20, "y", -1]); // y
        keyMap.set("y'", [-20, 20, "y", 1]); // y'
        keyMap.set("B", [-20, -lowerBound, "z", 1]); // B
        keyMap.set("B'", [-20, -lowerBound, "z", -1]); // B'
        const args = keyMap.get(move);
        if (send) {
            sendMove(move);
        }
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
        this.tween = new Tween(this.group.rotation)
                        .to({[axis]: mult * Math.PI / 2}, 200)
                        .easing(Easing.Quadratic.Out)
                        .onComplete(() => { this.isSolved(); })
                        .start();
    }
}

function degToRad(deg) {
    return deg * Math.PI / 180;
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
    }

    isSolved() {
        super.isSolved();
        if (this.solved) stopTimer();
    }

    makeMove(move, send=true, scramble=false) {
        if (!scramble && !isStarted()) { startTimer()};
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
        const axisCoord = Math.round(this.mouseDownObject.sticker.position[rotateAroundLabel]);

        // rotated layer in standard notation
        const rotatedName = this.faceName[rotateAroundLabel][axisCoord];

        // get axis, around which the pieces will rotate
        const rotationAxis = this.faceToRotationAxis.get(rotatedName);

        // triple product calculation
        // does the vector rotate around the axis in a clockwise or anticlockwise direction?
        // positive determinant - anticlockwise
        // negative determinant - clockwise
        const matrix = new THREE.Matrix3();
        matrix.set(
            rotationAxis.x,  rotationAxis.y,  rotationAxis.z,
            clickedPosition.x, clickedPosition.y, clickedPosition.z,
            move_dir.x,      move_dir.y,      move_dir.z
        )
        const determinant = matrix.determinant();

        let move = rotatedName;
        // move was anticlockwise
        if (determinant > 0) move = move + "'";
        this.makeMove(move);
    }
}

export { Cube, MovableCube };