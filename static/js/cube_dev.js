import * as THREE from './libs/three.module.js'
import * as TWEEN from './libs/tween.module.js'
import { OrbitControls } from './libs/OrbitControls.js';
import { addForRender, removeForRender, requestRenderIfNotRequested } from './render.js';

const xAxis = ["x", new THREE.Vector3(1, 0, 0)];
const yAxis = ["y", new THREE.Vector3(0, 1, 0)];
const zAxis = ["z", new THREE.Vector3(0, 0, 1)];

const Axis = {
    "x": 0,
    "y": 1,
    "z": 2
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


const MIDDLE_LAYERS = "MSE"
const MINUS_LAYERS = "DBLM"
const ROTATIONS = "xyz"

class Move {
    constructor(axis, dir, double) {
        this.axis = axis;
        this.dir = dir;
        this.double = double;
    }
}

class LayerMove extends Move {
    constructor(face, axis, flipped, index, dir, wide, double) {
        super(axis, dir, double);
        this.face = face;
        this.index = index;
        this.wide = wide;
        this.flipped = flipped;
    }

    toString() {
        let string = "";
        if (this.offset > 0) string += this.offset + 1;
        string += this.face;
        if (this.wide) string += "w";
        if (this.double) string += "2";

        if ((this.flipped && this.dir == 1) ||
            (!this.flipped && this.dir == -1)) {
                string += "'"
        };

        return string;
    }

    changeAxis(newAxis, negateAxis) {
        this.axis = newAxis;

        if (negateAxis) {
            this.coord = -this.coord;
            this.dir *= -1;
        }

        this.face = getFace(this.axis, this.coord);
        this.flipped = flippedRotation.get(this.face);

    }

    get_indices(n) {
        if (MIDDLE_LAYERS.includes(this.face)) {
            return [(n - 1) / 2]
        }

        let indices = []
        indices.push(this.index - 1)

        if (this.wide) {
            if (this.index == 1) {
                indices = [0, 1];
            } else {
                indices = []
                for (let i = 0; i < this.index; ++i) {
                    indices.push(i);
                }
            }
        }

        if (!MINUS_LAYERS.includes(this.face)) {
            for (let i = 0; i < indices.length; ++i) {
                indices[i] = n - 1 - indices[i];
            }
        }

        return indices
    }
}

class Rotation extends Move {
    constructor(axis, dir, double=false) {
        super(axis, dir, double);
        this.flipped = 1;
    }

    toString() {
        let string = this.axis;
        if (this.double) {
            string += "2";
        }
        if (this.dir == -1) {
            string += "'";
        }
        return string;
    }

    changeAxis(newAxis, negateAxis) {
        this.axis = newAxis;
        if (negateAxis) {
            this.dir *= -1;
        }
    }

    get_indices(n) {
        const indices = []
        for (let i = 0; i < n; ++i) {
            indices.push(i);
        }
        return indices;
    }
}

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

    const isRotation = "xyz".includes(face);

    let wide = i < move.length && move[i] == "w"
    if (wide) {
        i += 1
    }

    if ('a' <= face && face <= 'z' && !isRotation) {
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

    if (isRotation) {
        return new Rotation(face, dir, double);
    }

    const [axis, flipped] = faceToAxis.get(face);
    return new LayerMove(face, axis, flipped, layer_index, dir, wide, double);
}



class Cube {
    constructor(n, canvas) {
        this.n = n;
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

        this.firstLayerPosition = -(this.n - 1) / 2;

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

    toggleSpeedMode() {
        this.speedMode = !this.speedMode;
        this.draw();
    }

    changeLayers(newLayers) {
        this.n = parseInt(newLayers);
        this.draw();
        this.firstLayerPosition = -(this.n - 1) / 2;
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
        const centerOffset = -(this.n - 1) / 2;
        // const state = "RWOWWWWWWRGOGGGGGGROBOOOOOORBOBBBBBBBRORRRRRRRYOYYYYYY";
        const state = "RGGBWORYRYRYBOBOYGBGWYGYWGWORBORWOWOWOGRBRGWBYGRBYWYOB";
        const n = this.n;

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
        const centerOffset = -(this.n - 1) / 2;
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        for (let i = 0; i < this.n; ++i) {
            for (let j = 0; j < this.n; ++j) {
                for (let k = 0; k < this.n; ++k) {
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

        this.camera.position.set(0, this.n + this.n / 2 - 1.2, this.n + this.n / 2 + 1)
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
        const rotated = nj.rot90(layer, -1 * dir).clone()

        for (let i = 0; i < this.n; ++i) {
            for (let j = 0; j < this.n; ++j) {
                layer.set(i, j, rotated.get(i, j))
            }
        }
    }

    clearGroup() {
        // remove all cubies from group that was used for rotating the cubies
        // on screen and remove the group from the scene
        for (var i = this.group.children.length - 1; i >= 0; --i) {
            this.scene.attach(this.group.children[i]);
        }
        this.scene.remove(this.group);
    }

    makeMove(move_string) {
        // if previous move animation was still in progress, force it to end
        // this would not work correctly without calling .stop() first
        if (this.tween && this.tween.isPlaying()) {
            this.tween.stop();
            this.tween.end();
        }

        const move = parse_move(move_string);

        // get actual move direction
        // for example clockwise rotation of the right face and clockwise
        // rotation of the left face rotate the pieces in opposite directions
        // around the same axis
        const direction = (move.flipped == -1) ? move.dir * -1 : move.dir;

        // group all cubies that are being rotated
        // the group has a pivot (the point around which we rotate)
        // at (0, 0, 0). Rotating individual cubies before adding them first
        // to a group with a pivot rotates them around their own axis.
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // get layer indices of layers we rotate
        // for rotations, this is [0, ..., n-1]
        const indices = move.get_indices(this.n);

        for (let index of indices) {
            // get all cubies from given layer
            const layer = this.getLayer(move.axis, index);
            // rotate cubies in internal object representation
            this.rotate_layer(move.axis, index, direction)

            // get cubies objects that will be rotated
            const group_indices = layer.flatten().tolist();
            for (const group_index of group_indices) {
                this.group.attach(this.cubies[group_index]);
            }
        }

        // rotate layer on screen
        this.tween = new TWEEN.Tween(this.group.rotation)
                        .to({[move.axis]: -1 * direction * Math.PI / 2}, 200)
                        .easing(TWEEN.Easing.Quadratic.Out)
                        .onComplete(() => {
                            removeForRender(this);
                            this.clearGroup();
                        })
                        .start();

        // add cube to render queue
        addForRender(this);
        requestRenderIfNotRequested();
    }
}

export { Cube };