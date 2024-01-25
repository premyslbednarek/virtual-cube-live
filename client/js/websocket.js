import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';
import { drawAnotherCube, moveAnotherCube, moveAnotherCamera } from './main.js';

localStorage.debug = 'socket.io-client:socket'
let socket = io("http://localhost:8080")

socket.on("message", function(data) {
    console.log("Incoming message: ", data);
    socket.emit("ack", "Client received the message successfully.");
});

socket.on("welcome", function(data) {
    console.log("Connected users:", data.usersIds)
    for (var id of data.usersIds) {
        drawAnotherCube(id);
    }
});

socket.on("ack", function(data) {
    console.log("The server has gotten the message", data);
});

socket.on("connection", function(id) {
    drawAnotherCube(id);
})

socket.on("opponentMove", function(data) {
    var id = data[0];
    var args = JSON.parse(data[1]);
    moveAnotherCube(id, args);
})

socket.on("opponentCamera", function(data) {
    var id = data[0];
    var args = JSON.parse(data[1]);
    moveAnotherCamera(id, args);
})

function sendMove(args) {
    socket.emit("move", JSON.stringify(args));
}

function sendCamera(args) {
    socket.emit("camera", JSON.stringify(args));
}
export {sendMove, sendCamera};