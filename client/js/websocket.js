import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';

localStorage.debug = 'socket.io-client:socket'
let socket = io("http://localhost:8080")

socket.on("message", function(data) {
    console.log("Incoming message: ", data);
    socket.emit("ack", "Client received the message successfully.");
});

socket.on("ack", function(data) {
    console.log("The server has gotten the message", data);
});

socket.on("connection", function(data) {
    const scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(5, 0, 0);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(300, 300);
    document.body.appendChild( renderer.domElement );
    let cube = new Cube(3,scene, camera);
	renderer.render( scene, camera );
})