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

function drawLine(start: THREE.Vector3, end: THREE.Vector3, scene: THREE.Scene, color = 0x0000ff) {
    var material = new THREE.LineBasicMaterial( { color: color, linewidth: 5 } );
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

export function getClosestVectorIndex(targetVector: THREE.Vector2, vectors: THREE.Vector2[]) {
    // return vector from Array of vectors that has the smallest angle to targetVector
    const angles = vectors.map(vector => vector.angleTo(targetVector));
    const smallest_angle = Math.min(...angles);
    return angles.indexOf(smallest_angle);
}

export function getNormal(plane: THREE.Object3D) {
    const stickerNormal = new THREE.Vector3();
    plane.getWorldDirection(stickerNormal);
    stickerNormal.round();
    return stickerNormal;

}

export function getClosestOrthogonalVector(
    stickerNormal: THREE.Vector3,
    clickedCoordinates: THREE.Vector3,
    mouseVector: THREE.Vector2,
    camera: THREE.PerspectiveCamera
) {
        // get four orthogonal vectors (perpendicular to the basis vectors) in the 3D space
        // and get their 2D screen projections
        // vector with the smallest angle to mouseVector will determine the direction of the move
        const orthogonalVectors = getOrtogonalVectors(stickerNormal);

        const startPoint = clickedCoordinates;
        const endPoints = orthogonalVectors.map((vector) => vector.clone().add(startPoint));

        const startPointScreen = getScreenCoordinates(startPoint, camera);
        const endPointsScreen = endPoints.map((point) => getScreenCoordinates(point, camera));
        const screenDirs = endPointsScreen.map((end) => end.sub(startPointScreen));

        const closestVectorIndex = getClosestVectorIndex(mouseVector, screenDirs);
        return orthogonalVectors[closestVectorIndex];
}

export function getRotationAxis(moveDirection: THREE.Vector3, stickerNormal: THREE.Vector3) {
    const axes: ["x" | "y" | "z", THREE.Vector3][] = [
        ["x", new THREE.Vector3(1, 0, 0)],
        ["y", new THREE.Vector3(0, 1, 0)],
        ["z", new THREE.Vector3(0, 0, 1)]
    ]

    for (let i = 0; i < axes.length; ++i) {
        const vector = axes[i][1];
        if (vector.dot(moveDirection) === 0 && vector.dot(stickerNormal) === 0) {
            return axes[i];
        }
    }
    throw new Error("Two provided vector were not orthogonal.")
}

export function getAxisIndex(axis: "x" | "y" | "z", sticker: THREE.Object3D) {
    if (!sticker.parent) {
        throw new Error("Sticker has no parent");
    }

    const componentIndex = axis === "x" ? 0 :  axis === "y" ? 1 : 2;

    let coord = sticker.parent.position.getComponent(componentIndex);
    // round to the nearest 0.5
    coord = Math.round(coord * 2) / 2;
    return coord
}

export function getTurnDirection(axisVector: THREE.Vector3, clickedCoordinates: THREE.Vector3, moveDirection: THREE.Vector3, flipped: boolean) {
    // triple product calculation
    // does the vector rotate around the axis in a clockwise or anticlockwise direction?
    // positive determinant - anticlockwise
    // negative determinant - clockwise
    const matrix = new THREE.Matrix3();
    matrix.set(
        axisVector.x,  axisVector.y,  axisVector.z,
        clickedCoordinates.x, clickedCoordinates.y, clickedCoordinates.z,
        moveDirection.x,      moveDirection.y,      moveDirection.z
    )
    const determinant = matrix.determinant();

    let rotationSign = 1;
    if (determinant > 0) {
        rotationSign *= -1;
    }
    if (flipped) {
        rotationSign *= -1;
    }

    return rotationSign;
}

export { getOrtogonalVectors, getScreenCoordinates, degToRad, drawLine, sleep };