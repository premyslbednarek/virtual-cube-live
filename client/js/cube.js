import * as THREE from './three.module.js'

class Cube {
    constructor(size) {
        this.size = size;
        console.log(`Created a ${size}x${size} cube`);
    }

    draw(scene, speedMode=true) {
        console.log("kreslim");
        var centerOffset = -(this.size - 1) / 2;
        // clear scene
        scene.remove.apply(scene, scene.children);

        if (!speedMode) {
            const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
            const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
            const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            for (let i = 0; i < this.size; ++i) {
                for (let j = 0; j < this.size; ++j) {
                    for (let k = 0; k < this.size; ++k) {
                        const cubie = boxMesh.clone();
                        cubie.position.set(i + centerOffset, j + centerOffset, k + centerOffset);
                        scene.add(cubie);
                    }
                }
            }
        }

        var stickerGeometry;
        if (speedMode) {
            stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);
        } else {
            stickerGeometry = new THREE.PlaneGeometry(0.93, 0.93);
        }

        let faceCenters = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
        let colors = [0xffa200, 0xff1100, 0xffffff, 0xfffb00, 0x33ff00, 0x0800ff];

        for (let n = 0; n < 6; ++n) {
            for (let i = 0; i < this.size; ++i) {
                for (let j = 0; j < this.size; ++j) {
                    const stickerMaterial = new THREE.MeshBasicMaterial( {color: colors[n], side: THREE.DoubleSide} );
                    const stickerMesh = new THREE.Mesh(stickerGeometry, stickerMaterial);
                    // Mesh.clone() does not clone the material - it has to be copied by hand
                    // https://github.com/mrdoob/three.js/issues/14223 
                    let sticker = stickerMesh.clone();
                    sticker.lookAt(faceCenters[n]);
                    sticker.translateZ(-centerOffset + 0.5 + 0.001);
                    sticker.translateX(centerOffset + i);
                    sticker.translateY(centerOffset + j);

                    // var stickerAxis = new THREE.AxesHelper(2);
                    // sticker.add(stickerAxis);

                    scene.add(sticker);
                }
            }
        }
    }
}

export { Cube };