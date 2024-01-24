import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube, MovableCube } from './cube.js';
import { sendMove, sendCamera } from './websocket.js';
import * as TWEEN from './tween.module.js';

let cube = new MovableCube(3, document.getElementById("mainCanvas"));

async function performMacro(macro) {
    for (var i = 0; i < macro.length; ++i) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: macro[i], }));
        await new Promise(r => setTimeout(r, 150));
    }
}
window.performMacro = performMacro;

const otherCubes = []
function drawAnotherCube() {
    otherCubes.push(new Cube(3, document.getElementById("otherCanvas")));
}

function moveAnotherCube(args) {
    otherCubes[0].rotateGroupGen(...args);
}

function moveAnotherCamera(args) {
    otherCubes[0].camera.position.x = args.position.x;
    otherCubes[0].camera.position.y = args.position.y;
    otherCubes[0].camera.position.z = args.position.z;
    otherCubes[0].camera.rotation.x = args.rotation.x;
    otherCubes[0].camera.rotation.y = args.rotation.y;
    otherCubes[0].camera.rotation.z = args.rotation.z;
    otherCubes[0].camera.lookAt(0, 0, 0);
}

export { drawAnotherCube, moveAnotherCube, moveAnotherCamera };

function uperm() {
    performMacro("ifijijifkfkk");
}
function rInt(max) {
    return Math.floor(Math.random() * max);
}
function scramble() {
    var moves = "asdfjkl;ghieb";
    var s = ""
    for (var i = 0; i < 25; i++) {
        s += moves[rInt(moves.length) + 1];
    }
    performMacro(s);
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

function drawLine(pointA, pointB) {
    var material = new THREE.LineBasicMaterial( { color: 0x0000ff, linewidth: 5 } );
    const points = [];
    points.push(pointA);
    points.push(pointB);
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    var line = new THREE.Line( geometry, material );
    scene.add( line )
}

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
    stop() {
        const timeElapsed = performance.now() - this.startTime;
        console.log(Math.floor(timeElapsed / 1000) + "s");
        this.startTime = undefined;
    }
}

const timerElement = document.getElementById("timer");
const timer = new Timer(timerElement);
const startTimer = () => { timer.start(); };
const stopTimer = () => { timer.stop(); };
const isStarted = () => { return timer.startTime != undefined; }
export { startTimer, stopTimer, isStarted };

async function animate() {
	cube.renderer.render(cube.scene,cube.camera);
    for (const otherCube of otherCubes) {
        otherCube.renderer.render(otherCube.scene, otherCube.camera);
    }
    TWEEN.update();

    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 1000 / fps);

    // uncomment the following line for smoother movements
	// requestAnimationFrame( animate );
    // comment this fro smoothness
    // await new Promise(r => setTimeout(r, 1000));
    // animate();

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    // required if controls.enableDamping or controls.autoRotate are set to true
	// controls.update();
}
animate();

// resize the canvas when the windows size changes
window.addEventListener('resize', () => { cube.resizeCanvas(); }, false);

document.addEventListener("keydown", event => {
    let args = cube.keyMap.get(event.key);
    // expand array of parameters with ...args
    if (args) {
        sendMove(args);
        cube.rotateGroupGen(...args);
    }
});

function speedModeToggle() {
    cube.toggleSpeedMode();
}

const button = document.getElementById('speedToggle');
button.addEventListener('click', speedModeToggle);

window.isSolved = () => { return cube.isSolved(); };