import { Vector3 } from "./three.module.js";
import * as THREE from "./three.module.js"


function getOrtogonalVectors(vec) {
    const vector = vec.clone().round();
    const possible = [
        new Vector3( 1,  0,  0),
        new Vector3(-1,  0,  0),
        new Vector3( 0,  1,  0),
        new Vector3( 0, -1,  0),
        new Vector3( 0,  0,  1),
        new Vector3( 0,  0, -1)
    ];
    return possible.filter((other) => vector.dot(other) == 0);
}

function getScreenCoordinates(vector, camera) {
    const vec = vector.clone();
    vec.project(camera);
    return new THREE.Vector2(
        ( vec.x + 1) * window.innerWidth / 2,
        - ( vec.y - 1) * window.innerHeight / 2
    );
}

export { getOrtogonalVectors, getScreenCoordinates };