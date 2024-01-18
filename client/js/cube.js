import * as THREE from './three.module.js'

function getNormalVectors(vector) {
    let normals = [];
    if (vector.x == 0) normals.push(new THREE.Vector3(1, 0, 0));
    if (vector.y == 0) normals.push(new THREE.Vector3(0, 1, 0));
    if (vector.z == 0) normals.push(new THREE.Vector3(0, 0, 1));
    return normals;
}

function rotateStickerAroundAxis(sticker, axis, rad) {
    let rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationAxis(axis, rad);
    sticker.matrix.multiply(rotationMatrix);
    sticker.rotation.setFromRotationMatrix(sticker.matrix)
}


class Cube {
    constructor(size) {
        this.size = size;
        console.log(`Created a ${size}x${size} cube`);
    }

    draw(scene) {
        console.log("kreslim");

        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        for (let i = 0; i < this.size; ++i) {
            for (let j = 0; j < this.size; ++j) {
                for (let k = 0; k < this.size; ++k) {
                    const cubie = boxMesh.clone();
                    cubie.position.set(i - 1, j - 1, k - 1);
                    scene.add(cubie);
                }
            }
        }

        const stickerGeometry = new THREE.PlaneGeometry(0.95, 0.95);

        let faceCenters = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
        let colors = [0xffa200, 0xff1100, 0xffffff, 0xfffb00, 0x33ff00, 0x0800ff];

        for (let n = 0; n < 6; ++n) {
            const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors[n], side: THREE.DoubleSide} );
            const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
            for (let i = 0; i < this.size; ++i) {
                for (let j = 0; j < this.size; ++j) {
                    let sticker = stickerMesh.clone();
                    sticker.lookAt(faceCenters[n]);
                    sticker.translateZ(1.501);
                    sticker.translateX(-1 + i);
                    sticker.translateY(-1 + j);

                    // var stickerAxis = new THREE.AxesHelper(2);
                    // sticker.add(stickerAxis);

                    scene.add(sticker);
                }
            }
        }
    }
}

export { Cube };