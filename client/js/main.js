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
camera.position.set(3,3,3);
controls.update();

document.body.appendChild( renderer.domElement );

// draw a green box in the middle 
// let boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// let boxMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// let cube = new THREE.Mesh( boxGeometry, boxMaterial );
// scene.add( cube );


// visualize the axes
// X is red, Y is green, Z is blue
const axesHelper = new THREE.AxesHelper( 2 );
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
    camera.position.set(newLayers, newLayers, newLayers);
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
function rotateGroup() {
    if (tween && tween.isPlaying()) {
        tween.end();
    }
    // first, clear the group
    for (var i = group.children.length - 1; i >= 0; --i) {
        console.log(group.children[i].position);
        scene.attach(group.children[i]);
    }
    scene.remove(group);
    group = new THREE.Group();
    scene.add(group);
    
    // construct new group
    for (var i = scene.children.length - 1; i >= 0; --i) {
        if (scene.children[i].position.y > 0.3) {
            group.attach(scene.children[i]);
        }
    }

    // tween
    tween = new TWEEN.Tween(group.rotation).to({y: group.rotation.y + Math.PI/2}, 300).easing(TWEEN.Easing.Quadratic.Out);
    tween.start();
}
window.rotateGroup = rotateGroup;

function rotateGroup2() {
    if (tween && tween.isPlaying()) {
        tween.end();
    }
    // first, clear the group
    for (var i = group.children.length - 1; i >= 0; --i) {
        console.log(group.children[i].position);
        scene.attach(group.children[i]);
    }
    
    scene.remove(group);
    group = new THREE.Group();
    scene.add(group);
    
    
    // construct new group
    for (var i = scene.children.length - 1; i >= 0; --i) {
        if (scene.children[i].position.x > 0.3) {
            group.attach(scene.children[i]);
        }
    }

    // tween
    tween = new TWEEN.Tween(group.rotation).to({x: group.rotation.x + Math.PI/2}, 300).easing(TWEEN.Easing.Quadratic.Out);
    tween.start();
}
window.rotateGroup2 = rotateGroup2;

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);
document.addEventListener("keydown", event => {
  if (event.isComposing || event.keyCode == 85) {
    rotateGroup();
  }
  else if (event.isComposing || event.keyCode == 74) {
    rotateGroup2();
  }
});
window.scene = scene