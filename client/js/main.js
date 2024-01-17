import { OrbitControls } from './OrbitControls.js'
import { Scene, PerspectiveCamera, WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from './three.module.js'

const scene = new Scene();
let camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(3,3,3)

const renderer = new WebGLRenderer();

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

const geometry = new BoxGeometry( 1, 1, 1 );
const material = new MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new Mesh( geometry, material );
scene.add( cube );

// camera.position.z = 5;

function animate() {
	requestAnimationFrame( animate );
	renderer.render( scene, camera );

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    // required if controls.enableDamping or controls.autoRotate are set to true
	// controls.update();
}
animate();

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);