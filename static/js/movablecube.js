import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
import { OrbitControls } from './libs/OrbitControls.js';
import { Cube } from './cube.js';
import { sendMove, sendCamera, sendReset, sendSolve, socket } from './websocket.js';
import { requestRenderIfNotRequested } from './main.js';
import { Timer, startTimer, stopTimer, isStarted } from './timer.js';
import { getOrtogonalVectors, getScreenCoordinates, degToRad, drawLine, sleep } from './utils.js';

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

class Solve {
    constructor(scramble) {
        this.scramble = scramble;
        this.startTime = performance.now();
        this.events = [];
    }

    logMove(move) {
        this.events.push(["move", performance.now() - this.startTime, move]);
    }

    logCamera(pos) {
        this.events.push(["rotation", performance.now() - this.startTime, pos.clone()]);
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
        this.controls.addEventListener('end', () => this.onCameraChange());
        this.controls.addEventListener('change', () => this.onCameraChange());
        this.timer = new Timer(document.getElementById("timer"));
        this.solve = undefined;
        this.solveHistory = [];
    }

    replayStep(eventType, arg) {
        if (eventType == "move") {
            super.makeMove(arg, false);
        } else if (eventType == "rotation") {
            this.camera.position.copy(arg);
            this.camera.lookAt(0, 0, 0);
            this.render();
        } else {
            alert("unknown eventType")
        }
    }

    async replay(solve) {
        this.reset();
        this.scramble(solve.scramble);
        let lastTime = solve.startTime;
        for (const [eventType, time, arg] of solve.events) {
            await sleep(time - lastTime);
            this.replayStep(eventType, arg);
            lastTime = time;
        }
    }

    replay_from_id(id) {
        socket.emit("getSolve", id, (solve) => this.replay({scramble: JSON.parse(solve.scramble), events: JSON.parse(solve.solution)}));
    }

    replay_last() {
        const solve = JSON.parse(localStorage.getItem("lastSolve"));
        this.replay(solve);
    }

    addToTable(solveID, timeString) {
        const timeListElement = document.getElementById("times");
        const div = document.createElement("div");
        div.innerHTML = `${solveID}: ${timeString} <a href="/solve/${solveID}" target="_blank">replay</a>`;
        timeListElement.appendChild(div);
        let times = JSON.parse(localStorage.getItem("times"));
        if (!times) times = [];
        times.push({time: timeString, solveID: solveID});
        localStorage.setItem("times", JSON.stringify(times));
        // timeListElement.innerHTML += `<br> ${solveID}: ${timeString}`;
    }

    isSolved() {
        super.isSolved();
        if (this.timer.started && this.solved) {
            const timeString = this.timer.stop()
            this.solveHistory.push(this.solve);
            localStorage.setItem("lastSolve", JSON.stringify(this.solve));
            // const response = sendSolve(this.solve);
            const solveData = {
                solution: this.solve.events,
                scramble: this.solve.scramble,
                timeString: timeString,
                layers: this.layers
            }
            socket.emit("uploadSolve", solveData, (solveID) => this.addToTable(solveID, timeString));
            this.solve = undefined;
        };
    }

    scramble(scramble) {
        this.reset();
        this.solve = new Solve(scramble);
        for (const move of scramble) {
            this.makeMove(move, true, true);
            // super.makeMove(move);
        }
        this.timer.startInspection();
    }

    makeMove(move, send=true, scramble=false) {
        if (send) {
            sendMove(move);
        }
        if (!scramble && !isRotation(move) && this.timer.inspection) { this.timer.start()};
        if (!scramble && this.solve) {
            this.solve.logMove(move);
        }
        super.makeMove(move, send);

    }

    onCameraChange() {
        if (this.solve) {
            this.solve.logCamera(this.camera.position);
        }
        sendCamera(this.camera.position);
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

export { MovableCube };