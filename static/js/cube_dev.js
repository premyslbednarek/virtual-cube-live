import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
import { OrbitControls } from './libs/OrbitControls.js';
// import { requestRenderIfNotRequested } from './main.js';
import { addForRender, removeForRender, requestRenderIfNotRequested } from './render.js';

const xAxis = ["x", new THREE.Vector3(1, 0, 0)];
const yAxis = ["y", new THREE.Vector3(0, 1, 0)];
const zAxis = ["z", new THREE.Vector3(0, 0, 1)];

const Axis = {
    "x": 0,
    "y": 1,
    "z": 2
}

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

const CW = 1
const CCW = -1

function parse_move(move) {
    let i = 0
    let layer_index = 0
    while ('0' < move[i] && move[i] <= '9') {
        layer_index *= 10;
        layer_index += move[i] - '0';
        ++i;
    }

    if (layer_index == 0) {
        layer_index = 1
    }

    let face = move[i];
    i += 1;

    let wide = i < move.length && move[i] == "w"
    if (wide) {
        i += 1
    }

    if ('a' <= face && face <= 'z' && face != "x" && face != "y" && face != "z") {
        wide = true;
        face = face.toUpperCase();
    }

    let double = i < move.length && move[i] == "2";
    if (double) {
        i += 1
    }

    let dir = CW
    if (i < move.length && move[i] == "'") {
        dir = CCW
    }

    let axis, flipped;
    if ("xyz".includes(face)) {
        [axis, flipped] = [face, 1]
    } else {
        [axis, flipped] = faceToAxis.get(face);
    }

    return {
        face: face,
        index: layer_index,
        wide: wide,
        double: double,
        dir: dir,
        axis: axis,
        flipped: flipped
    }
}
window.parse_move = parse_move

const MIDDLE_LAYERS = "MSE"
const MINUS_LAYERS = "DBLM"
const ROTATIONS = "xyz"

function get_indices(move, n) {
    if (MIDDLE_LAYERS.includes(move.face)) {
        return [(n - 1) / 2]
    }

    let indices = []
    indices.push(move.index - 1)

    if ("xyz".includes(move.face)) {
        indices = []
        for (let i = 0; i < n; ++i) {
            indices.push(i);
        }
        return indices;
    }

    if (move.wide) {
        if (move.index == 1) {
            indices = [0, 1];
        } else {
            indices = []
            for (let i = 0; i < move.index; ++i) {
                indices.push(i);
            }
        }
    }

    if (MINUS_LAYERS.includes(move.face)) {
        for (let i = 0; i < indices.length; ++i) {
            indices[i] = n - 1 - indices[i];
        }
    }

    return indices
}

window.get_indices = get_indices

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

        this.solved = true;
        this.needsSolvedCheck = false;

        this.firstLayerPosition = -(this.layers - 1) / 2;

        const n = layers
        const number_of_cubies = n*n*n;
        const cubies = []
        for (var i = 0; i < number_of_cubies; ++i) {
            cubies.push(new THREE.Group())
        }

        this.cubies = cubies
        // self.cubies indices
        this.arr = nj.arange(number_of_cubies).reshape(n, n, n)

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false; // disable moving the camera with right click
        this.controls.update();
        this.controls.addEventListener('change', () => this.render());

        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const group_index = this.arr.get(i, j, k);
                    const group = cubies[group_index];
                    group.position.set(this.firstLayerPosition + i, this.firstLayerPosition + j, this.firstLayerPosition + k);
                    this.scene.add(group);
                }
            }
        }

        this.draw();
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

    getMesh(color) {
        let stickerGeometry;
        if (this.speedMode) {
            stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
        } else {
            stickerGeometry = new THREE.PlaneGeometry(0.93, 0.93);
        }

        let colors = {
            "R": 0xff1100, // red
            "O": 0xffa200, // orange
            "W": 0xffffff, // white
            "Y": 0xfffb00, // yellow
            "G": 0x33ff00, // green
            "B": 0x0800ff  // blue
        };

        const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors[color], side: THREE.DoubleSide} );
        const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
        return stickerMesh;
    }

    drawStickers() {
        const centerOffset = -(this.layers - 1) / 2;
        // const state = "RWOWWWWWWRGOGGGGGGROBOOOOOORBOBBBBBBBRORRRRRRRYOYYYYYY";
        const state = "RROGWBOYBYGRBGGOWWYRYRRBRYYGWBWBOGBWWWBYOYGGWBOGOYROOR";
        const n = this.layers;

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

        this.stickers = [];
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

        for (const group of this.cubies) {
            this.scene.add(group);
        }

        if (!this.speedMode) {
            this.drawCubies();
        }

        this.drawStickers();
        this.render();
    }

    getLayer(axis, index) {
        let x = null, y = null, z = null;
        if (axis == "x") {
            x = index;
        } else if (axis == "y") {
            y = index;
        } else if (axis == "z") {
            z = index;
        } else {
        }
        return this.arr.pick(x, y, z);
    }

    rotate_layer(axis, index, dir) {
        if (axis == "y") { dir *= -1; }
        const layer = this.getLayer(axis, index);
        const rotated = nj.rot90(layer, dir).clone()

        for (let i = 0; i < this.layers; ++i) {
            for (let j = 0; j < this.layers; ++j) {
                layer.set(i, j, rotated.get(i, j))
            }
        }
    }

    makeMove(move_string) {
        if (this.tween && this.tween.isPlaying()) {
            this.tween.stop(); // this would not work without stopping it first (+-2h debugging)
            this.tween.end();
        }


        const move = parse_move(move_string);
        const indices = get_indices(move, this.layers);


        this.cleanGroup();
        this.group = new THREE.Group();


        let dir = move.dir;
        if (move.flipped == -1) {
            dir *= -1;
        }

        for (let index of indices) {
            index = this.layers - 1 - index;
            const layer = this.getLayer(move.axis, index);
            this.rotate_layer(move.axis, index, -1 * dir)
            const group_indices = layer.flatten().tolist();
            for (const group_index of group_indices) {
                this.group.attach(this.cubies[group_index]);
            }
        }


        window.group = this.group

        this.scene.add(this.group);

        this.tween = new TWEEN.Tween(this.group.rotation)
                        .to({[move.axis]: -1 * dir * Math.PI / 2}, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => { removeForRender(this); this.cleanGroup(); })
                        .start();

        addForRender(this);
        requestRenderIfNotRequested();


        return;
        const scene = this.scene;

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
                        .onComplete(() => { removeForRender(this); })
                        .start();

        addForRender(this);
        requestRenderIfNotRequested();
    }

    makeMove2(move) {
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