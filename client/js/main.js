import { Cube, MovableCube } from './cube.js';
import { sendLayerChange } from './websocket.js';
import * as TWEEN from './libs/tween.module.js';
import keybinds from './keybindings.js';

let cube = new MovableCube(3, document.getElementById("mainCanvas"));

const otherCubes = new Map();
function drawAnotherCube(id) {
    const canvas = document.createElement("canvas");
    canvas.style = "width: 100%; height: 250px"
    document.getElementById("otherCanvases").appendChild(canvas);
    // otherCubes.push(new Cube(3, document.getElementById("otherCanvas")));
    otherCubes.set(id, new Cube(3, canvas));
}

function changeLayers(id, newLayers) {
    const otherCube = otherCubes.get(id);
    otherCube.changeLayers(newLayers);
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

async function performMacro(macro) {
    for (var i = 0; i < macro.length; ++i) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: macro[i], }));
        await new Promise(r => setTimeout(r, 150));
    }
}

function uperm() {
    performMacro("ifijijifkfkk");
}
document.getElementById("upermButton").addEventListener("click", uperm)

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
document.getElementById("scrambleButton").addEventListener("click", scramble);

let slider = document.getElementById("layersSlider");
let layersInfo = document.getElementById("layersInfo");
slider.oninput = function() {
    const newLayers = this.value;
    layersInfo.innerHTML = `Layers: ${newLayers}`;
    cube.changeLayers(newLayers);
    sendLayerChange(newLayers);
}

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

// var fps = 30;
// window.fps = fps;
// const fpsSlider = document.getElementById("fpsSlider");
// const fpsInfo = document.getElementById("fpsInfo");
// function updateFps() {
//     const newFps = fpsSlider.value;
//     fpsInfo.innerHTML = newFps;
//     fps = newFps;
// }
// fpsSlider.oninput = updateFps;
// updateFps();
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


window.addEventListener('mousedown', (event) => cube.mouseDown(event));
window.addEventListener('mouseup', (event) => cube.mouseUp(event));

document.addEventListener("keydown", event => {
    let move = keybinds.get(event.key);
    // expand array of parameters with ...args
    if (move) {
        cube.makeKeyboardMove(move);
    }
});

const button = document.getElementById('speedToggle');
button.addEventListener('click', () => cube.toggleSpeedMode());

const resetButton = document.getElementById("reset");
resetButton.addEventListener("click", () => { 
    if (isStarted()) timer.stop(false);
    cube.draw();
}, false);

export {
    startTimer,
    stopTimer,
    isStarted,
    drawAnotherCube,
    moveAnotherCube,
    moveAnotherCamera,
    removeCube,
    changeLayers,
    animateTweens,
    requestRenderIfNotRequested,
};