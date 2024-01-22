import * as THREE from './three.module.js'

class Cube {
    constructor(size, scene, camera) {
        this.size = size;
        this.scene = scene;
        this.camera = camera;
        this.speedMode = true;
        this.tween;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        console.log(`Created a ${size}x${size} cube`);
        this.draw();
    }
    cleanGroup() {
        for (var i = this.group.children.length - 1; i >= 0; --i) {
            this.scene.attach(this.group.children[i]);
        }
        this.scene.remove(this.group);
    }

    toggleSpeedMode() {
        this.speedMode = !this.speedMode;
        this.draw();
    }

    changeLayers(newLayers) {
        this.size = parseInt(newLayers);
        this.draw();
    }

    getClickedAxis(pos) {
        const stickerPosition = this.size / 2 + 0.01;
        if (Math.abs(stickerPosition - Math.abs(pos.x)) < 0.1) return "x";
        if (Math.abs(stickerPosition - Math.abs(pos.y)) < 0.1) return "y";
        if (Math.abs(stickerPosition - Math.abs(pos.z)) < 0.1) return "z";
    }


    draw() {
        const scene = this.scene;
        var centerOffset = -(this.size - 1) / 2;
        // clear scene
        scene.remove.apply(scene, scene.children);
        console.log(this.size, this.size + (this.size / 2) + 1)
        this.camera.position.set(0, this.size + this.size / 2 + 1, this.size + this.size / 2 + 1)
        this.camera.lookAt(0, 0, 0);
        // visualize the axes
        // X is red, Y is green, Z is blue
        const axesHelper = new THREE.AxesHelper( 10 );
        scene.add( axesHelper );

        if (!this.speedMode) {
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
        if (this.speedMode) {
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
                    sticker.isSticker = true;
                    // var stickerAxis = new THREE.AxesHelper(2);
                    // sticker.add(stickerAxis);

                    scene.add(sticker);
                }
            }
        }
    }
    rotateGroupGen(checkFunction, axis, mult) {
        const scene = this.scene;
        
        console.log("rotation started", checkFunction, axis, mult);
        if (this.tween && this.tween.isPlaying()) {
            this.tween.end();
            this.cleanGroup();
        }

        this.cleanGroup();
        
        // construct new group
        this.group = new THREE.Group();
        for (var i = scene.children.length - 1; i >= 0; --i) {
            if (scene.children[i].type == "AxesHelper") continue;
            if (checkFunction(scene.children[i])) {
                this.group.attach(scene.children[i]);
            }
        }
        scene.add(this.group);

        // tween
        // [axis] - this is the usage of "computed property name" introduced in ES6
        this. tween = new TWEEN.Tween(this.group.rotation).to({[axis]: mult * Math.PI / 2}, 200).easing(TWEEN.Easing.Quadratic.Out);
        // tween.onComplete(cleanGroup);
        this.tween.start();
    }
}

export { Cube };