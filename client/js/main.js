import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';

const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({antialias: true});

function resizeCanvas() {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // must be called after changing camera's properties
}

resizeCanvas();

async function performMacro(macro) {
    for (var i = 0; i < macro.length; ++i) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: macro[i], }));
        await new Promise(r => setTimeout(r, 150));
    }
}
window.performMacro = performMacro;

function uperm() {
    performMacro("ifijijifkfkk");
}
function rInt(max) {
    return Math.floor(Math.random() * max);
}
function scramble() {
    var moves = "asdfjkl;ghieb";
    var s = ""
    for (var i = 0; i < 25; i++) {
        s += moves[rInt(moves.length) + 1];
    }
    performMacro(s);
}
window.scramble = scramble;
window.uperm = uperm;

const controls = new OrbitControls(camera, renderer.domElement);
//controls.update() must be called after any manual changes to the camera's transform
// camera.position.set( 0, 20, 100 );
// controls.minDistance = 5;
// controls.maxDistance = 20;
controls.enableZoom = false;
controls.enablePan = false; // disable moving the camera with right click
camera.position.set(0,5,5);
controls.update();

document.body.appendChild( renderer.domElement );

// draw a green box in the middle 
// let boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// let boxMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// let cube = new THREE.Mesh( boxGeometry, boxMaterial );
// scene.add( cube );


// visualize the axes
// X is red, Y is green, Z is blue
// const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );

let cube = new Cube(3);
cube.draw(scene);

let slider = document.getElementById("layersSlider");
let layersInfo = document.getElementById("layersInfo");
slider.oninput = function() {
    const newLayers = this.value;
    layersInfo.innerHTML = `Layers: ${newLayers}`;
    cube = new Cube(newLayers);
    cube.draw(scene);
    camera.position.set(newLayers, newLayers, 0);
    camera.lookAt(0,0,0);
}

function drawLine(pointA, pointB) {
    var material = new THREE.LineBasicMaterial( { color: 0x0000ff, linewidth: 5 } );
    const points = [];
    points.push(pointA);
    points.push(pointB);
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    var line = new THREE.Line( geometry, material );
    scene.add( line )
}

// raycasting for determining, what was clicked
// https://threejs.org/docs/index.html?q=ray#api/en/core/Raycaster
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0; // never intersect with a line (lines are for development visualization purposes)

const pointer = new THREE.Vector2();
var mouseDownPointer;
var axisMovements = [];

function getClickedAxis(pos) {
    if (Math.abs(1.501 - Math.abs(pos.x)) < 0.1) return "x";
    if (Math.abs(1.501 - Math.abs(pos.y)) < 0.1) return "y";
    if (Math.abs(1.501 - Math.abs(pos.z)) < 0.1) return "z";
}

function onMouseDown( event ) {
    cleanGroup();
    axisMovements = undefined;
    // console.log("Mouse down coordinates:", event.clientX, event.clientY);
	// calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    mouseDownPointer = event;

    // update the picking ray with the camera and pointer position
	raycaster.setFromCamera( pointer, camera );

	// calculate objects intersecting the picking ray
	const intersects = raycaster.intersectObjects( scene.children );
    // console.log("Number of objects intersected:", intersects.length);

    if (intersects.length && intersects[0].object.isSticker) {
        controls.enabled = false; // disable rotating camera
        var pos = intersects[0].object.position;
        // console.log("clicked stijijiijijcker position", pos.x, pos.y, pos.z)
        var clickedAxis = getClickedAxis(pos);
        window.pos = pos;
        var sign = pos[clickedAxis] / Math.abs(pos[clickedAxis]);
        // console.log(clickedAxis, sign);
        var pointA = intersects[0].point;
        var v1 = new THREE.Vector3(0, 0, 0);
        var v2 = new THREE.Vector3(0, 0, 0);
        if (clickedAxis == "x") {
            if (sign > 0) {
                v1.z = 1;
                v2.y = -1;
            } else {
                v1.z = -1;
                v2.y = 1;
            }
        } else if (clickedAxis == "y") {
            if (sign > 0) {
                v1.z = -1;
                v2.x = 1;
            } else {
                v1.z = 1;
                v2.x = -1;
            }
        } else {
            if (sign > 0) {
                v1.y = 1;
                v2.x = -1;
            } else {
                v1.y = -1;
                v2.x = 1;
            }
        }
        // console.log(v1, v2);
        // drawLine(pointA, pointA.clone().add(v1));
        // drawLine(pointA, pointA.clone().add(v2));
        var v1_neg = v1.clone().multiplyScalar(-1);
        var v2_neg = v2.clone().multiplyScalar(-1);
        // drawLine(pointA, pointA.clone().add(v1_neg));
        // drawLine(pointA, pointA.clone().add(v2_neg));
        axisMovements = {clickedAxis: clickedAxis, clickedPosition: intersects[0].point, stickerPosition: pos, vectors: [v1, v2, v1_neg, v2_neg] };

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
window.addEventListener('mousedown', onMouseDown);

function onMouseUp(event) {
    // enable controls, that were disable on mouse down
    controls.enabled = true;
    // no sticker was clicked
    if (axisMovements == undefined) return;

    var x = event.clientX;
    var y = event.clientY;
	// var x = ( event.clientX / window.innerWidth ) * 2 - 1;
	// var y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    var movementVector = new THREE.Vector3(x - mouseDownPointer.clientX, y - mouseDownPointer.clientY, 0);

    if (movementVector.length() < 10) {
        controls.enabled = true;
        axisMovements = [];
        return;
    }

    // console.log("Mouse vector", movementVector);
    var angles = []
    for (var vector of axisMovements.vectors) {
        var vectorS = axisMovements.clickedPosition.clone();
        vectorS.project(camera);
        vectorS.x = ( vectorS.x + 1) * window.innerWidth / 2;
        vectorS.y = - ( vectorS.y - 1) * window.innerHeight / 2;
        vectorS.z = 0;
        // console.log("S", vectorS);
        var vectorE = axisMovements.clickedPosition.clone().add(vector);
        vectorE.project(camera);
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
    var bestVector = axisMovements.vectors[lowestAngleIndex];
    console.log("Lowest angle is: ", lowestAngle*57, "to vector", axisMovements.vectors[lowestAngleIndex]);
    console.log(axisMovements.clickedAxis)
    var sign = axisMovements.stickerPosition[axisMovements.clickedAxis] / Math.abs(axisMovements.stickerPosition[axisMovements.clickedAxis]);
    if (axisMovements.clickedAxis == "x") {
        if (bestVector.y != 0) {
            rotateGroupGen((obj) => Math.abs(obj.position.z - axisMovements.stickerPosition.z) < 0.75,"z", sign*bestVector.y / Math.abs(bestVector.y));
        } else {
            rotateGroupGen((obj) => Math.abs(obj.position.y - axisMovements.stickerPosition.y) < 0.75,"y", sign*-bestVector.z / Math.abs(bestVector.z));
        }
    }
    if (axisMovements.clickedAxis == "y") {
        if (bestVector.x != 0) {
            rotateGroupGen((obj) => Math.abs(obj.position.z - axisMovements.stickerPosition.z) < 0.75,"z", sign*-bestVector.x / Math.abs(bestVector.x));
        } else {
            rotateGroupGen((obj) => Math.abs(obj.position.x - axisMovements.stickerPosition.x) < 0.75,"x", sign*bestVector.z / Math.abs(bestVector.z));
        }
    }
    if (axisMovements.clickedAxis == "z") {
        if (bestVector.x != 0) {
            rotateGroupGen((obj) => Math.abs(obj.position.y - axisMovements.stickerPosition.y) < 0.75,"y", sign*bestVector.x / Math.abs(bestVector.x));
        } else {
            rotateGroupGen((obj) => Math.abs(obj.position.x - axisMovements.stickerPosition.x) < 0.75,"x", sign*-bestVector.y / Math.abs(bestVector.y));
        }
    }

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
    controls.enabled = true;
}
window.addEventListener('mouseup', onMouseUp);

const fps = 30;
async function animate() {
	renderer.render( scene, camera );
    TWEEN.update();

    setTimeout(() => {
        requestAnimationFrame(animate);
    }, 1000 / fps);

    // uncomment the following line for smoother movements
	// requestAnimationFrame( animate );
    // comment this fro smoothness
    // await new Promise(r => setTimeout(r, 1000));
    // animate();

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    // required if controls.enableDamping or controls.autoRotate are set to true
	// controls.update();
}
animate();

var tween;
var group = new THREE.Group();
scene.add(group);

function cleanGroup() {
    for (var i = group.children.length - 1; i >= 0; --i) {
        scene.attach(group.children[i]);
    }
    scene.remove(group);
}
window.cleanGroup = cleanGroup;

function rotateGroupGen(checkFunction, axis, mult) {
    console.log("rotation started", checkFunction, axis, mult);
    if (tween && tween.isPlaying()) {
        tween.end();
        cleanGroup();
    }

    // first, clear the previosly used group
    for (var i = group.children.length - 1; i >= 0; --i) {
        scene.attach(group.children[i]);
    }
    scene.remove(group);
    
    // construct new group
    group = new THREE.Group();
    for (var i = scene.children.length - 1; i >= 0; --i) {
        if (scene.children[i].type == "AxesHelper") continue;
        if (checkFunction(scene.children[i])) {
            group.attach(scene.children[i]);
        }
    }
    scene.add(group);

    // tween
    // [axis] - this is the usage of "computed property name" introduced in ES6
    tween = new TWEEN.Tween(group.rotation).to({[axis]: mult * Math.PI / 2}, 200).easing(TWEEN.Easing.Quadratic.Out);
    // tween.onComplete(cleanGroup);
    tween.start();
}

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);

const keyMap = new Map();
keyMap.set("j", [(obj) => obj.position.y > 0.3, "y", -1]); // U
keyMap.set("f", [(obj) => obj.position.y > 0.3, "y", 1]);  // U'
keyMap.set("i", [(obj) => obj.position.x > 0.3, "x", -1]); // R
keyMap.set("k", [(obj) => obj.position.x > 0.3, "x", 1]);  // R'
keyMap.set("b", [(_) => true, "x", 1]); // x'
keyMap.set("n", [(_) => true, "x", 1]); // x'
keyMap.set("t", [(_) => true, "x", -1]); // x
keyMap.set("y", [(_) => true, "x", -1]); // x
keyMap.set("d", [(obj) => obj.position.x < -0.3, "x", 1]); // L
keyMap.set("e", [(obj) => obj.position.x < -0.3, "x", -1]);  // L'
keyMap.set("g", [(obj) => obj.position.z > 0.3, "z", 1]); // F
keyMap.set("h", [(obj) => obj.position.z > 0.3, "z", -1]);  // F'
keyMap.set("l", [(obj) => obj.position.y < -0.3, "y", -1]); // D'
keyMap.set("s", [(obj) => obj.position.y < -0.3, "y", 1]);  // D
keyMap.set(";", [(_) => true, "y", -1]); // y
keyMap.set("a", [(_) => true, "y", 1]); // y'

document.addEventListener("keydown", event => {
    let args = keyMap.get(event.key);
    // expand array of parameters with ...args
    if (args) { rotateGroupGen(...args); }
});

// expose local variables to browser's console
window.rotateGroupGen = rotateGroupGen;
window.scene = scene

var speedMode = true;
function speedModeToggle() {
    speedMode = !speedMode;
    console.log("Speed mode toggled.");
    cube.draw(scene, speedMode);
}

const button = document.getElementById('speedToggle');
button.addEventListener('click', speedModeToggle);