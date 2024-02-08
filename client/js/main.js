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

function moveAnotherCamera(id, position) {
    const otherCube = otherCubes.get(id);
    otherCube.camera.position.copy(position);
    otherCube.camera.lookAt(0, 0, 0);
    otherCube.render();
}

function resetAnotherCube(id) {
    const otherCube = otherCubes.get(id);
    otherCube.draw();
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

    cube.scramble(scramble);
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
resetButton.addEventListener("click", () =>  cube.reset(), false);

const replayButton = document.getElementById("replay");
replayButton.addEventListener("click", () => cube.replay_last(), false);

export {
    drawAnotherCube,
    moveAnotherCube,
    moveAnotherCamera,
    resetAnotherCube,
    removeCube,
    changeLayers,
    animateTweens,
    requestRenderIfNotRequested,
};