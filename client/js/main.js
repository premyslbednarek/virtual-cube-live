import { OrbitControls } from './OrbitControls.js'
import * as THREE from './three.module.js'

const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(3,3,3)

const renderer = new THREE.WebGLRenderer();

function resizeCanvas() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must be called after changing camera's properties
}

resizeCanvas();

const controls = new OrbitControls(camera, renderer.domElement);
//controls.update() must be called after any manual changes to the camera's transform
// camera.position.set( 0, 20, 100 );
controls.minDistance = 2;
controls.maxDistance = 100;
controls.enableZoom = false;
controls.enablePan = false; // disable moving the camera with right click
controls.update();


document.body.appendChild( renderer.domElement );

let geometry = new THREE.BoxGeometry( 1, 1, 1 );
let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
let cube = new THREE.Mesh( geometry, material );
scene.add( cube );

let plane;
for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
        geometry = new THREE.PlaneGeometry( 0.9, 0.9 );
        material = new THREE.MeshBasicMaterial( {color: 0xff0000, side: THREE.DoubleSide} );
        plane = new THREE.Mesh( geometry, material );
        plane.position.set(i-1, j-1, 0.5001);

        scene.add( plane );
    }
}

for (let i = 0; i < 3; ++i) {
    for (let j = 0; j < 3; ++j) {
        geometry = new THREE.PlaneGeometry( 0.9, 0.9 );
        material = new THREE.MeshBasicMaterial( {color: 0x0000ff, side: THREE.DoubleSide} );
        plane = new THREE.Mesh( geometry, material );
        plane.position.set(i-1, j-1, -0.5001);

        scene.add( plane );
    }
}


async function animate() {
    // uncomment the following line for smoother movements
	requestAnimationFrame( animate );
    // comment this fro smoothness
    // await new Promise(r => setTimeout(r, 200));

	renderer.render( scene, camera );
    console.log(1);

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    // required if controls.enableDamping or controls.autoRotate are set to true
	// controls.update();
}
animate();

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);