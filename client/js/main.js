const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();

function resizeCanvas() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must be called after changing camera's properties
}

resizeCanvas();

document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

function animate() {
	requestAnimationFrame( animate );
	renderer.render( scene, camera );
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
}
animate();

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);