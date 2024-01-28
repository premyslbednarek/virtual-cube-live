import { OrbitControls } from './OrbitControls.js';
import * as THREE from './three.module.js';
import { Cube } from './cube.js';
import { drawAnotherCube, moveAnotherCube, moveAnotherCamera, removeCube, changeLayers } from './main.js';

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

socket.on("disconnection", function(id) {
    console.log("remove cube with id", id);
    removeCube(id);
})

socket.on("opponentMove", function(data) {
    var id = data[0];
    var move = data[1];
    moveAnotherCube(id, move);
})

socket.on("opponentLayers", function(data) {
    var id = data[0];
    var newLayers = data[1];
    changeLayers(id, newLayers);
})

socket.on("opponentCamera", function(data) {
    var id = data[0];
    var args = JSON.parse(data[1]);
    moveAnotherCamera(id, args);
})

function sendLayerChange(newLayers) {
    socket.emit("layersChange", newLayers);
}

function sendMove(move) {
    socket.emit("move", move);
}

function sendCamera(args) {
    socket.emit("camera", JSON.stringify(args));
}
export {sendMove, sendCamera, sendLayerChange};