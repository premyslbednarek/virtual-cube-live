import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
// import { requestRenderIfNotRequested } from './main.js';
import { addForRender, removeForRender, requestRenderIfNotRequested } from './render.js';

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
    constructor(axis, rotationSign, double=false) {
        this.axis = axis;
        this.rotationSign = rotationSign;
        this.double = double;
    }
}

class LayerMove extends Move {
    constructor(face, axis, flippedRotation, offset, coord, rotationSign, wide, double=false) {
        super(axis, rotationSign, double);
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
        if (this.double) string += "2";

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
    constructor(axis, rotationSign, double=false) {
        super(axis, rotationSign, double);
    }

    toString() {
        let string = this.axis;
        if (this.double) {
            string += "2";
        }
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

        let double = false;
        if (string[string.length -1] == "2") {
            double = true;
            // remove 2 from string
            string = string.slice(0, -1);
        }

        if (isRotation(string)) {
            const axis = string[0];
            return new Rotation(axis, rotationDir, double);
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

        return new LayerMove(face, axis, flippedAxis, layerOffset, coord, rotationDir, wide, double);
    }

    resizeCanvas() {
        const canvas = this.renderer.domElement;
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix(); // must be called after changing camera's properties
        this.render();
    }

    render() {
        console.log("render")
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

    makeMove(move) {
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

        if (moveObj.double) {
            moveObj.rotationSign *= 2;
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
                        .onComplete(() => { removeForRender(this); this.isSolved(); })
                        .start();

        addForRender(this);
        requestRenderIfNotRequested();
    }
}

export { Cube };