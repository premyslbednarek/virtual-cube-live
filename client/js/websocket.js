import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';
import { drawAnotherCube, moveAnotherCube } from './main.js';

localStorage.debug = 'socket.io-client:socket'
let socket = io("http://localhost:8080")

socket.on("message", function(data) {
    console.log("Incoming message: ", data);
    socket.emit("ack", "Client received the message successfully.");
});

socket.on("welcome", function(data) {
    if (data.users > 0) {
        drawAnotherCube();
    }
});

socket.on("ack", function(data) {
    console.log("The server has gotten the message", data);
});

socket.on("connection", function(data) {
    drawAnotherCube();
})

socket.on("opponentMove", function(data) {
    var args = JSON.parse(data);
    moveAnotherCube(args);
})

function sendMove(args) {
    socket.emit("move", JSON.stringify(args));
}
export {sendMove};