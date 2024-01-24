import * as THREE from './three.module.js'
import { OrbitControls } from './OrbitControls.js';
import { sendMove } from './websocket.js';

class Cube {
    constructor(layers, canvas) {
        this.layers = layers;
        this.scene = new THREE.Scene();
        this.canvas = canvas;
        this.camera = new THREE.PerspectiveCamera(
            75, 
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({antialias: true, canvas});
        this.speedMode = true;
        this.tween;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.keyMap = new Map();
        this.stickers = [];

        console.log(`Created a ${layers}x${layers} cube`);
        this.resizeCanvas();
        this.draw();
    }

    resizeCanvas() {
        const canvas = this.renderer.domElement;
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
        this.camera.updateProjectionMatrix(); // must be called after changing camera's properties
    }


    cleanGroup() {
        for (var i = this.group.children.length - 1; i >= 0; --i) {
            this.scene.attach(this.group.children[i]);
        }
        this.scene.remove(this.group);
    }

    getStickerFace(sticker) {
        const stickerPosition = this.layers / 2 + 0.01;
        if (Math.abs(stickerPosition - sticker.position.x) < 0.1) return "R";
        if (Math.abs(stickerPosition - sticker.position.y) < 0.1) return "U";
        if (Math.abs(stickerPosition - sticker.position.z) < 0.1) return "F";
        if (Math.abs(-stickerPosition - sticker.position.x) < 0.1) return "L";
        if (Math.abs(-stickerPosition - sticker.position.y) < 0.1) return "D";
        if (Math.abs(-stickerPosition - sticker.position.z) < 0.1) return "B";
    }

    isSolved() {
        this.cleanGroup();
        const colorToFace = new Map();
        for (const sticker of this.stickers) {
            const color = sticker.material.color.getHex();
            const face = this.getStickerFace(sticker);
            if (colorToFace.has(color)) {
                if (colorToFace.get(color) != face) return false;
            } else {
                colorToFace.set(color, face);
            }
        }
        console.log("Cube is solved!")
        return true;
    }

    toggleSpeedMode() {
        this.speedMode = !this.speedMode;
        this.draw();
    }

    changeLayers(newLayers) {
        this.layers = parseInt(newLayers);
        this.draw();
        this.generateKeymap();
    }

    getClickedAxis(pos) {
        const stickerPosition = this.layers / 2 + 0.01;
        if (Math.abs(stickerPosition - Math.abs(pos.x)) < 0.1) return "x";
        if (Math.abs(stickerPosition - Math.abs(pos.y)) < 0.1) return "y";
        if (Math.abs(stickerPosition - Math.abs(pos.z)) < 0.1) return "z";
    }

    draw() {
        const scene = this.scene;
        var centerOffset = -(this.layers - 1) / 2;
        // clear scene
        scene.remove.apply(scene, scene.children);
        this.camera.position.set(0, this.layers + this.layers / 2 + 1, this.layers + this.layers / 2 + 1)
        this.camera.lookAt(0, 0, 0);
        // visualize the axes
        // X is red, Y is green, Z is blue
        const axesHelper = new THREE.AxesHelper( 10 );
        scene.add( axesHelper );

        if (!this.speedMode) {
            const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
            const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00000});
            const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            for (let i = 0; i < this.layers; ++i) {
                for (let j = 0; j < this.layers; ++j) {
                    for (let k = 0; k < this.layers; ++k) {
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

        this.stickers = [];
        for (let n = 0; n < 6; ++n) {
            for (let i = 0; i < this.layers; ++i) {
                for (let j = 0; j < this.layers; ++j) {
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
                    this.stickers.push(sticker);
                    scene.add(sticker);
                }
            }
        }
    }

    rotateGroupGen(low, high, axis, mult) {
        const scene = this.scene;
        
        // console.log("rotation started", low, high, axis, mult);
        if (this.tween && this.tween.isPlaying()) {
            this.tween.end();
            this.cleanGroup();
        }

        this.cleanGroup();
        
        // construct new group
        this.group = new THREE.Group();
        for (var i = scene.children.length - 1; i >= 0; --i) {
            if (scene.children[i].type == "AxesHelper") continue;
            if (low <= scene.children[i].position[axis] && scene.children[i].position[axis] <= high) {
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

function degToRad(deg) {
    return deg * Math.PI / 180;
}

class MovableCube extends Cube {
    constructor(layers, canvas) {
        super(layers, canvas);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false; // disable moving the camera with right click
        this.controls.minAzimuthAngle = degToRad(-35);
        this.controls.maxAzimuthAngle = degToRad(35);
        this.controls.minPolarAngle = degToRad(60);
        this.controls.maxPolarAngle = degToRad(120);
        this.controls.update();
        this.generateKeymap();
    }

    generateKeymap() {  
        const lowerBound = (this.layers / 2) - 1;
        const keyMap = this.keyMap;
        keyMap.clear(); // remove all key-value pairs

        keyMap.set("j", [lowerBound, 20, "y", -1]); // U
        keyMap.set(",", [lowerBound-1, 20, "y", -1]); // Uw = U wide - two upper layers
        keyMap.set("f", [lowerBound, 20, "y", 1]);  // U'
        keyMap.set("c", [lowerBound-1, 20, "y", 1]);  // Uw'
        keyMap.set("i", [lowerBound, 20, "x", -1]); // R
        keyMap.set("u", [lowerBound-1, 20, "x", -1]); // Rw
        keyMap.set("k", [lowerBound, 20, "x", 1]);  // R'
        keyMap.set("m", [lowerBound-1, 20, "x", 1]);  // Rw'
        keyMap.set("b", [-20, 20, "x", 1]); // x'
        keyMap.set("n", [-20, 20, "x", 1]); // x'
        keyMap.set("t", [-20, 20, "x", -1]); // x
        keyMap.set("y", [-20, 20, "x", -1]); // x
        keyMap.set("d", [-20, -lowerBound, "x", 1]); // L
        keyMap.set("v", [-20, -lowerBound+1, "x", 1]); // Lw
        keyMap.set("e", [-20, -lowerBound, "x", -1]);  // L'
        keyMap.set("v", [-20, -lowerBound+1, "x", -1]);  // Lw'
        keyMap.set("g", [lowerBound, 20, "z", 1]); // F
        keyMap.set("h", [lowerBound, 20, "z", -1]);  // F'
        keyMap.set("l", [-20, -lowerBound, "y", -1]); // D'
        keyMap.set("s", [-20, -lowerBound, "y", 1]);  // D
        keyMap.set(";", [-20, 20, "y", -1]); // y
        keyMap.set("a", [-20, 20, "y", 1]); // y'
    }


    mouseDown(event) {
        this.pointer = new THREE.Vector2();
        this.mouseDownPointer;
        this.axisMovements = [];

        this.cleanGroup();
        this.axisMovements = undefined;
        // console.log("Mouse down coordinates:", event.clientX, event.clientY);
        // calculate pointer position in normalized device coordinates
        // (-1 to +1) for both components
        this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        this.mouseDownPointer = event;

        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 0; // never intersect with a line (lines are for development visualization purposes)
        // update the picking ray with the camera and pointer position
        raycaster.setFromCamera(this.pointer, this.camera );

        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(this.scene.children );
        // console.log("Number of objects intersected:", intersects.length);

        if (intersects.length && intersects[0].object.isSticker) {
            this.controls.enabled = false; // disable rotating camera
            var pos = intersects[0].object.position;
            // console.log("clicked stijijiijijcker position", pos.x, pos.y, pos.z)
            var clickedAxis = this.getClickedAxis(pos);
            var otherAxes = [];
            if (clickedAxis != "x") otherAxes.push("x");
            if (clickedAxis != "y") otherAxes.push("y");
            if (clickedAxis != "z") otherAxes.push("z");
            window.pos = pos;
            var sign = pos[clickedAxis] / Math.abs(pos[clickedAxis]);
            // console.log(clickedAxis, sign);
            var pointA = intersects[0].point;
            var v1 = new THREE.Vector3(0, 0, 0);
            var v2 = new THREE.Vector3(0, 0, 0);
            v1[otherAxes[0]] = 1;
            v2[otherAxes[1]] = 1;
            // code below refactored out
            // if (clickedAxis == "x") {
            //     if (sign > 0) {
            //         v1.z = 1;
            //         v2.y = -1;
            //     } else {
            //         v1.z = -1;
            //         v2.y = 1;
            //     }
            // } else if (clickedAxis == "y") {
            //     if (sign > 0) {
            //         v1.z = -1;
            //         v2.x = 1;
            //     } else {
            //         v1.z = 1;
            //         v2.x = -1;
            //     }
            // } else {
            //     if (sign > 0) {
            //         v1.y = 1;
            //         v2.x = -1;
            //     } else {
            //         v1.y = -1;
            //         v2.x = 1;
            //     }
            // }
            // console.log(v1, v2);
            // drawLine(pointA, pointA.clone().add(v1));
            // drawLine(pointA, pointA.clone().add(v2));
            var v1_neg = v1.clone().multiplyScalar(-1);
            var v2_neg = v2.clone().multiplyScalar(-1);
            // drawLine(pointA, pointA.clone().add(v1_neg));
            // drawLine(pointA, pointA.clone().add(v2_neg));
            this.axisMovements = {clickedAxis: clickedAxis, clickedPosition: intersects[0].point, stickerPosition: pos, vectors: [v1, v2, v1_neg, v2_neg] };

            // if (Math.abs(1.501 - pointA.x) > 0.1) {
            //     var pointB = pointA.clone().add(new THREE.Vector3(1, 0, 0))
            //     pointB.multiplyScalar(sign);
            //     drawLine(pointA, pointB);
            //     axisMovements.push(["x", pointA, pointB]);
            // }
            // if (Math.abs(1.501 - pointA.y) > 0.1) {
            //     var pointB = pointA.clone().add(new THREE.Vector3(0, 1, 0))
            //     pointB.multiplyScalar(sign);
            //     drawLine(pointA, pointB);
            //     axisMovements.push(["y", pointA, pointB]);
            // }
            // if (Math.abs(1.501 - pointA.z) > 0.1) {
            //     var pointB = pointA.clone().add(new THREE.Vector3(0, 0, 1));
            //     pointB.multiplyScalar(sign);
            //     drawLine(pointA, pointB);
            //     axisMovements.push(["z", pointA, pointB]);
            // }
            // console.log("First intersected object", intersects[0]);
            // intersects[0].object.material.color.set( 0xff0000 );
        }
    }

    mouseUp(event) {
        // enable controls, that were disable on mouse down
        this.controls.enabled = true;
        // no sticker was clicked
        if (this.axisMovements == undefined) return;
        const axisMovements = this.axisMovements;

        var x = event.clientX;
        var y = event.clientY;
        // var x = ( event.clientX / window.innerWidth ) * 2 - 1;
        // var y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        var movementVector = new THREE.Vector3(x - this.mouseDownPointer.clientX, y - this.mouseDownPointer.clientY, 0);

        if (movementVector.length() < 10) {
            this.controls.enabled = true;
            this.axisMovements = [];
            return;
        }

        // console.log("Mouse vector", movementVector);
        var angles = []
        for (var vector of this.axisMovements.vectors) {
            var vectorS = this.axisMovements.clickedPosition.clone();
            vectorS.project(this.camera);
            vectorS.x = ( vectorS.x + 1) * window.innerWidth / 2;
            vectorS.y = - ( vectorS.y - 1) * window.innerHeight / 2;
            vectorS.z = 0;
            // console.log("S", vectorS);
            var vectorE = this.axisMovements.clickedPosition.clone().add(vector);
            vectorE.project(this.camera);
            vectorE.x = ( vectorE.x + 1) * window.innerWidth / 2;
            vectorE.y = - ( vectorE.y - 1) * window.innerHeight / 2;
            vectorE.z = 0;
            vectorE.sub(vectorS)

            var angle = movementVector.angleTo(vectorE);
            // console.log(`Vektor`, angle*57, vectorE);
            angles.push(angle);
        }

        var lowestAngleIndex = 0;
        var lowestAngle = angles[0];
        for (var i = 1; i < angles.length; ++i) {
            if (angles[i] < lowestAngle) {
                lowestAngle = angles[i];
                lowestAngleIndex = i;
            }
        }
        var bestVector = this.axisMovements.vectors[lowestAngleIndex];
        console.log("Lowest angle is: ", lowestAngle*57, "to vector", axisMovements.vectors[lowestAngleIndex]);
        console.log(this.axisMovements.clickedAxis)
        var sign = axisMovements.stickerPosition[axisMovements.clickedAxis] / Math.abs(axisMovements.stickerPosition[axisMovements.clickedAxis]);
        // var otherAxes = [];
        // if (axisMovements.clickedAxis != "x") otherAxes.push("x");
        // if (axisMovements.clickedAxis != "y") otherAxes.push("y");
        // if (axisMovements.clickedAxis != "z") otherAxes.push("z");

        // if (Math.abs(bestVector[otherAxes[1]]) == 1) {
        //     var temp = otherAxes[1];
        //     otherAxes[1] = otherAxes[0];
        //     otherAxes[0] = temp;
        // }
        // console.log("Vyhral vektor", bestVector);
        // var clickedAxis = axisMovements.clickedAxis;
        // var rotateAxis = otherAxes[1];
        // var rotateLayer = otherAxes[0];
        // var args = [];
        // args.push(axisMovements.stickerPosition[rotateAxis] - 0.75);
        // args.push(axisMovements.stickerPosition[rotateAxis] + 0.75);
        // args.push(rotateAxis);
        // // sign = bestVector[rotateLayer];
        // console.log(sign)
        // if (
        //     (clickedAxis == "x" && rotateAxis == "y") ||
        //     (clickedAxis == "y" && rotateAxis == "z") ||
        //     (clickedAxis == "z" && rotateAxis == "x")
        // ) {
        //     sign = -sign;
        // }
        // args.push(sign);
        var args;
        if (axisMovements.clickedAxis == "x") {
            if (bestVector.y != 0) {
                args = [axisMovements.stickerPosition.z - 0.75,axisMovements.stickerPosition.z + 0.75,"z", sign*bestVector.y / Math.abs(bestVector.y)];
            } else {
                args = [axisMovements.stickerPosition.y - 0.75,axisMovements.stickerPosition.y + 0.75,"y", sign*-bestVector.z / Math.abs(bestVector.z)];
            }
        }
        if (axisMovements.clickedAxis == "y") {
            if (bestVector.x != 0) {
                args = [axisMovements.stickerPosition.z - 0.75,axisMovements.stickerPosition.z + 0.75,"z", sign*-bestVector.x / Math.abs(bestVector.x)];
            } else {
                args = [axisMovements.stickerPosition.x - 0.75,axisMovements.stickerPosition.x + 0.75,"x", sign*bestVector.z / Math.abs(bestVector.z)];
            }
        }
        if (axisMovements.clickedAxis == "z") {
            if (bestVector.x != 0) {
                args = [axisMovements.stickerPosition.y - 0.75,axisMovements.stickerPosition.y + 0.75, "y", sign*bestVector.x / Math.abs(bestVector.x)];
            } else {
                args = [axisMovements.stickerPosition.x - 0.75,axisMovements.stickerPosition.x + 0.75, "x", sign*-bestVector.y / Math.abs(bestVector.y)];
            }
        }
        this.rotateGroupGen(...args);
        sendMove(args);

        // console.log("Angles", angles);
        // onMouseDown was previously called
        // var startPoint = new THREE.Vector3(
        //     ( ( prevEvent.clientX - renderer.domElement.offsetLeft ) / renderer.domElement.width ) * 2 - 1,
        //     - ( ( prevEvent.clientY - renderer.domElement.offsetTop ) / renderer.domElement.height ) * 2 + 1,
        //     prevEvent.clientZ           
        // );

        // var endPoint = new THREE.Vector3(
        //     ( ( event.clientX - renderer.domElement.offsetLeft ) / renderer.domElement.width ) * 2 - 1,
        //     - ( ( event.clientY - renderer.domElement.offsetTop ) / renderer.domElement.height ) * 2 + 1,
        //     event.clientZ           
        // );
        // console.log("Mouse up coordinates", event.clientX, event.clientY);
        // console.log(startPoint, endPoint)
        // // draw the vector (from click start point to click end point)
        // var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
        // const points = [];
        // points.push(startPoint);
        // points.push(endPoint)
        // const geometry = new THREE.BufferGeometry().setFromPoints(points);
        // var line = new THREE.Line( geometry, material );
        // scene.add( line )
        // controls.enabled = true;
    }
}

export { Cube, MovableCube };