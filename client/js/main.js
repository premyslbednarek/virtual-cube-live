import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';

const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({antialias: true});

function resizeCanvas() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must be called after changing camera's properties
}

resizeCanvas();

const controls = new OrbitControls(camera, renderer.domElement);
//controls.update() must be called after any manual changes to the camera's transform
// camera.position.set( 0, 20, 100 );
// controls.minDistance = 5;
// controls.maxDistance = 20;
controls.enableZoom = false;
controls.enablePan = false; // disable moving the camera with right click
camera.position.set(0,5,5);
controls.update();

document.body.appendChild( renderer.domElement );

// draw a green box in the middle 
// let boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// let boxMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// let cube = new THREE.Mesh( boxGeometry, boxMaterial );
// scene.add( cube );


// visualize the axes
// X is red, Y is green, Z is blue
// const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );

let cube = new Cube(3);
cube.draw(scene);

let slider = document.getElementById("layersSlider");
let layersInfo = document.getElementById("layersInfo");
slider.oninput = function() {
    const newLayers = this.value;
    // clear the scene
    scene.remove.apply(scene, scene.children);
    layersInfo.innerHTML = `Layers: ${newLayers}`;
    cube = new Cube(newLayers);
    cube.draw(scene);
    camera.position.set(newLayers+2, newLayers+2, 0);
    camera.lookAt(0,0,0);
}


const fps = 60;
async function animate() {
	renderer.render( scene, camera );
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

var tween;
var group = new THREE.Group();
scene.add(group);

function rotateGroupGen(checkFunction, axis, mult) {
    if (tween && tween.isPlaying()) {
        tween.end();
    }

    // first, clear the previosly used group
    for (var i = group.children.length - 1; i >= 0; --i) {
        scene.attach(group.children[i]);
    }
    scene.remove(group);
    
    // construct new group
    group = new THREE.Group();
    for (var i = scene.children.length - 1; i >= 0; --i) {
        if (checkFunction(scene.children[i])) {
            group.attach(scene.children[i]);
        }
    }
    scene.add(group);

    // tween
    // [axis] - this is the usage of "computed property name" introduced in ES6
    tween = new TWEEN.Tween(group.rotation).to({[axis]: mult * Math.PI / 2}, 200).easing(TWEEN.Easing.Quadratic.Out);
    tween.start();
}

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);

const keyMap = new Map();
keyMap.set("j", [(obj) => obj.position.y > 0.3, "y", -1]); // U
keyMap.set("f", [(obj) => obj.position.y > 0.3, "y", 1]);  // U'
keyMap.set("i", [(obj) => obj.position.x > 0.3, "x", -1]); // R
keyMap.set("k", [(obj) => obj.position.x > 0.3, "x", 1]);  // R'
keyMap.set("b", [(_) => true, "x", 1]); // x'
keyMap.set("n", [(_) => true, "x", 1]); // x'
keyMap.set("t", [(_) => true, "x", -1]); // x
keyMap.set("y", [(_) => true, "x", -1]); // x
keyMap.set("d", [(obj) => obj.position.x < -0.3, "x", 1]); // L
keyMap.set("e", [(obj) => obj.position.x < -0.3, "x", -1]);  // L'
keyMap.set("g", [(obj) => obj.position.z > 0.3, "z", 1]); // F
keyMap.set("h", [(obj) => obj.position.z > 0.3, "z", -1]);  // F'
keyMap.set("l", [(obj) => obj.position.y < -0.3, "y", -1]); // D'
keyMap.set("s", [(obj) => obj.position.y < -0.3, "y", 1]);  // D
keyMap.set(";", [(_) => true, "y", -1]); // y
keyMap.set("a", [(_) => true, "y", 1]); // y'

document.addEventListener("keydown", event => {
    let args = keyMap.get(event.key);
    // expand array of parameters with ...args
    if (args) { rotateGroupGen(...args); }
});

// expose local variables to browser's console
window.rotateGroupGen = rotateGroupGen;
window.scene = scene