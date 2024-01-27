import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube, MovableCube } from './cube.js';
import { sendMove, sendCamera } from './websocket.js';
import * as TWEEN from './tween.module.js';
import keybinds from './keybindings.js';

let cube = new MovableCube(3, document.getElementById("mainCanvas"));

async function performMacro(macro) {
    for (var i = 0; i < macro.length; ++i) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: macro[i], }));
        await new Promise(r => setTimeout(r, 150));
    }
}
window.performMacro = performMacro;

const otherCubes = new Map();
function drawAnotherCube(id) {
    const canvas = document.createElement("canvas");
    canvas.style = "width: 100%; height: 250px"
    document.getElementById("otherCanvases").appendChild(canvas);
    // otherCubes.push(new Cube(3, document.getElementById("otherCanvas")));
    otherCubes.set(id, new Cube(3, canvas));
}

function moveAnotherCube(id, move) {
    const otherCube = otherCubes.get(id);
    otherCube.makeMove(move, false);
}

function moveAnotherCamera(id, args) {
    const otherCube = otherCubes.get(id);
    otherCube.camera.position.x = args.position.x;
    otherCube.camera.position.y = args.position.y;
    otherCube.camera.position.z = args.position.z;
    otherCube.camera.rotation.x = args.rotation.x;
    otherCube.camera.rotation.y = args.rotation.y;
    otherCube.camera.rotation.z = args.rotation.z;
    otherCube.camera.lookAt(0, 0, 0);
    otherCube.render();
}

function removeCube(id) {
    console.log("remove cube", id);
    console.log(otherCubes);
    const otherCube = otherCubes.get(id);
    otherCube.canvas.remove();
    otherCubes.delete(id);
}

export { drawAnotherCube, moveAnotherCube, moveAnotherCamera, removeCube };

function uperm() {
    performMacro("ifijijifkfkk");
}
function randomInt(max) {
    return Math.floor(Math.random() * max);
}
function scramble() {
    const moves = ["R", "R'", "L", "L'", "U", "U'", "D", "D'", "F", "F'", "B", "B'"];
    const scramble = []
    for (var i = 0; i < 25; i++) {
        scramble.push(moves[randomInt(moves.length)]);
    }
    // finish the scramble with some rotations
    const rotations = ["y", "y'", "x", "x'", "z", "z'"];
    for (var i = 0; i < 4; i++) {
        scramble.push(rotations[randomInt(rotations.length)]);
    }

    for (const move of scramble) {
        cube.makeMove(move, true, true);
    }
}
window.scramble = scramble;
window.uperm = uperm;

function onCameraEnd() {
    sendCamera({position: cube.camera.position, rotation: cube.camera.rotation});
}


// draw a green box in the middle 
// let boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// let boxMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// let cube = new THREE.Mesh( boxGeometry, boxMaterial );
// scene.add( cube );

// visualize the axes
// X is red, Y is green, Z is blue
// const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );

cube.controls.addEventListener('end', onCameraEnd);
cube.controls.addEventListener('change', onCameraEnd);

let slider = document.getElementById("layersSlider");
let layersInfo = document.getElementById("layersInfo");
slider.oninput = function() {
    const newLayers = this.value;
    layersInfo.innerHTML = `Layers: ${newLayers}`;
    cube.changeLayers(newLayers);
}

function drawLine(start, end, scene) {
    var material = new THREE.LineBasicMaterial( { color: 0x0000ff, linewidth: 5 } );
    const points = [];
    points.push(start);
    points.push(end);
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    var line = new THREE.Line( geometry, material );
    scene.add( line )
}
export { drawLine }

// raycasting for determining, what was clicked
// https://threejs.org/docs/index.html?q=ray#api/en/core/Raycaster

function onMouseDown(event) {
    cube.mouseDown(event);
}
window.addEventListener('mousedown', onMouseDown);

function onMouseUp(event) {
    cube.mouseUp(event);
}
window.addEventListener('mouseup', onMouseUp);

var fps = 30;
window.fps = fps;

const fpsSlider = document.getElementById("fpsSlider");
const fpsInfo = document.getElementById("fpsInfo");

function updateFps() {
    const newFps = fpsSlider.value;
    fpsInfo.innerHTML = newFps;
    fps = newFps;
}

fpsSlider.oninput = updateFps;
updateFps();


class Timer {
    constructor(domElement) {
        this.domElement = domElement;
        this.startTime = undefined;
    }
    
    start() {
        this.startTime = performance.now();
        this.update();
    }
    async update() {
        if (!this.startTime) return;
        const timeElapsed = performance.now() - this.startTime;
        this.domElement.innerHTML = Math.floor(timeElapsed / 1000) + "s";
        setTimeout(() => {
            this.update();
        }, 1000);
    }
    stop(write=true) {
        const timeElapsed = performance.now() - this.startTime;
        const timeString = Math.floor(timeElapsed / 1000) + "s";
        console.log(timeString);
        this.startTime = undefined;
        if (!write) return;
        const timeListElement = document.getElementById("times");
        timeListElement.innerHTML += `<br> ${timeString}`;
    }
    resetDom() {
        this.innerHTML = "timer stopped";
    }
}

const timerElement = document.getElementById("timer");
const timer = new Timer(timerElement);
const startTimer = () => { timer.start(); };
const stopTimer = () => { timer.stop(); };
const isStarted = () => { return timer.startTime != undefined; }
export { startTimer, stopTimer, isStarted };

// async function animate() {
// 	cube.renderer.render(cube.scene,cube.camera);
//     for (let [_, cube] of otherCubes) {
//         cube.renderer.render(cube.scene, cube.camera);
//     }
//     TWEEN.update();
//     setTimeout(() => {
//         requestAnimationFrame(animate);
//     }, 1000 / fps);
// }
// animate();
// export { animate };

let renderRequested = false;
function animateTweens() {
    renderRequested = false;
    TWEEN.update();
    cube.render();
    for (let [_, other] of otherCubes) {
        other.render();
    }
    const all = TWEEN.getAll();
    if (TWEEN.getAll().length) {
        requestRenderIfNotRequested(animateTweens)
    }
}

function requestRenderIfNotRequested() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(animateTweens);
    }
}

export { animateTweens, requestRenderIfNotRequested }

// resize the canvas when the windows size changes
window.addEventListener('resize', () => {
    cube.resizeCanvas();
    for (let [_, otherCube] of otherCubes) {
        otherCube.resizeCanvas();
    }
}, false);

document.addEventListener("keydown", event => {
    let move = keybinds.get(event.key);
    // expand array of parameters with ...args
    if (move) {
        cube.makeMove(move);
    }
});

function speedModeToggle() {
    cube.toggleSpeedMode();
}

const button = document.getElementById('speedToggle');
button.addEventListener('click', speedModeToggle);

window.isSolved = () => { return cube.isSolved(); };

window.cube = cube;

const resetButton = document.getElementById("reset");
resetButton.addEventListener("click", () => { 
    timer.stop(false);
    cube.draw();
}, false);
