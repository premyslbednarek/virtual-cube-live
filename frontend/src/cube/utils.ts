import * as THREE from 'three';


function getOrtogonalVectors(vec: THREE.Vector3) {
    const vector = vec.clone().round();
    const possible = [
        new THREE.Vector3( 1,  0,  0),
        new THREE.Vector3(-1,  0,  0),
        new THREE.Vector3( 0,  1,  0),
        new THREE.Vector3( 0, -1,  0),
        new THREE.Vector3( 0,  0,  1),
        new THREE.Vector3( 0,  0, -1)
    ];
    return possible.filter((other) => vector.dot(other) === 0);
}

function getScreenCoordinates(vector: THREE.Vector3, camera: THREE.PerspectiveCamera) {
    const vec = vector.clone();
    vec.project(camera);
    return new THREE.Vector2(
        ( vec.x + 1) * window.innerWidth / 2,
        - ( vec.y - 1) * window.innerHeight / 2
    );
}

function degToRad(deg: number) {
    return deg * Math.PI / 180;
}

function drawLine(start: THREE.Vector3, end: THREE.Vector3, scene: THREE.Scene) {
    var material = new THREE.LineBasicMaterial( { color: 0x0000ff, linewidth: 5 } );
    const points = [];
    points.push(start);
    points.push(end);
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    var line = new THREE.Line( geometry, material );
    scene.add( line )
}

async function sleep(ms: number) {
    await new Promise(r => setTimeout(r, ms));
}

export { getOrtogonalVectors, getScreenCoordinates, degToRad, drawLine, sleep };