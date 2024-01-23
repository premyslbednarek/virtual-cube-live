import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';
import { sendMove, sendCamera } from './websocket.js';

let cube = new Cube(3, document.getElementById("mainCanvas"));

function resizeCanvas() {
    cube.renderer.setSize( window.innerWidth, window.innerHeight );
    cube.camera.aspect = window.innerWidth / window.innerHeight;
    cube.camera.updateProjectionMatrix(); // must be called after changing camera's properties
}

resizeCanvas();

async function performMacro(macro) {
    for (var i = 0; i < macro.length; ++i) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: macro[i], }));
        await new Promise(r => setTimeout(r, 150));
    }
}
window.performMacro = performMacro;

const otherCubes = []
function drawAnotherCube() {
    otherCubes.push(new Cube(3, document.getElementById("otherCanvas")));
}

function moveAnotherCube(args) {
    otherCubes[0].rotateGroupGen(...args);
}

function moveAnotherCamera(args) {
    otherCubes[0].camera.position.x = args.position.x;
    otherCubes[0].camera.position.y = args.position.y;
    otherCubes[0].camera.position.z = args.position.z;
    otherCubes[0].camera.rotation.x = args.rotation.x;
    otherCubes[0].camera.rotation.y = args.rotation.y;
    otherCubes[0].camera.rotation.z = args.rotation.z;
    otherCubes[0].camera.lookAt(0, 0, 0);
}

export { drawAnotherCube, moveAnotherCube, moveAnotherCamera };

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

function onCameraEnd() {
    sendCamera({position: cube.camera.position, rotation: cube.camera.rotation});
}


// draw a green box in the middle 
// let boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
// let boxMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// let cube = new THREE.Mesh( boxGeometry, boxMaterial );
// scene.add( cube );

function degToRad(deg) {
    return deg * Math.PI / 180;
}

cube.controls = new OrbitControls(cube.camera, cube.renderer.domElement);
cube.controls.enableZoom = false;
cube.controls.enablePan = false; // disable moving the camera with right click
cube.controls.minAzimuthAngle = degToRad(-35);
cube.controls.maxAzimuthAngle = degToRad(35);
cube.controls.minPolarAngle = degToRad(60);
cube.controls.maxPolarAngle = degToRad(120);
cube.controls.update();
cube.controls.addEventListener('end', onCameraEnd);
cube.controls.addEventListener('change', onCameraEnd);

// visualize the axes
// X is red, Y is green, Z is blue
// const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );

let slider = document.getElementById("layersSlider");
let layersInfo = document.getElementById("layersInfo");
slider.oninput = function() {
    const newLayers = this.value;
    cube.changeLayers(newLayers);
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

function onMouseDown( event ) {
    cube.cleanGroup();
    axisMovements = undefined;
    // console.log("Mouse down coordinates:", event.clientX, event.clientY);
	// calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    mouseDownPointer = event;

    // update the picking ray with the camera and pointer position
	raycaster.setFromCamera( pointer, cube.camera );

	// calculate objects intersecting the picking ray
	const intersects = raycaster.intersectObjects( cube.scene.children );
    // console.log("Number of objects intersected:", intersects.length);

    if (intersects.length && intersects[0].object.isSticker) {
        cube.controls.enabled = false; // disable rotating camera
        var pos = intersects[0].object.position;
        // console.log("clicked stijijiijijcker position", pos.x, pos.y, pos.z)
        var clickedAxis = cube.getClickedAxis(pos);
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
    cube.controls.enabled = true;
    // no sticker was clicked
    if (axisMovements == undefined) return;

    var x = event.clientX;
    var y = event.clientY;
	// var x = ( event.clientX / window.innerWidth ) * 2 - 1;
	// var y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    var movementVector = new THREE.Vector3(x - mouseDownPointer.clientX, y - mouseDownPointer.clientY, 0);

    if (movementVector.length() < 10) {
        cube.controls.enabled = true;
        axisMovements = [];
        return;
    }

    // console.log("Mouse vector", movementVector);
    var angles = []
    for (var vector of axisMovements.vectors) {
        var vectorS = axisMovements.clickedPosition.clone();
        vectorS.project(cube.camera);
        vectorS.x = ( vectorS.x + 1) * window.innerWidth / 2;
        vectorS.y = - ( vectorS.y - 1) * window.innerHeight / 2;
        vectorS.z = 0;
        // console.log("S", vectorS);
        var vectorE = axisMovements.clickedPosition.clone().add(vector);
        vectorE.project(cube.camera);
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
    cube.rotateGroupGen(...args);
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
window.addEventListener('mouseup', onMouseUp);

var fps = 30;
window.fps = fps;

const fpsSlider = document.getElementById("fpsSlider");
const fpsInfo = document.getElementById("fpsInfo");

function updateFps() {
    const newFps = fpsSlider.value;
    fpsInfo.innerHTML = newFps;
    fps = newFps;
}

fpsSlider.oninput = updateFps;
updateFps();


async function animate() {
	cube.renderer.render(cube.scene,cube.camera);
    for (const otherCube of otherCubes) {
        otherCube.renderer.render(otherCube.scene, otherCube.camera);
    }
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

// resize the canvas when the windows size changes
window.addEventListener('resize', resizeCanvas, false);

document.addEventListener("keydown", event => {
    let args = cube.keyMap.get(event.key);
    // expand array of parameters with ...args
    if (args) {
        sendMove(args);
        cube.rotateGroupGen(...args);
    }
});

// expose local variables to browser's console
window.rotateGroupGen = cube.rotateGroupGen;

function speedModeToggle() {
    cube.toggleSpeedMode();
}

const button = document.getElementById('speedToggle');
button.addEventListener('click', speedModeToggle);