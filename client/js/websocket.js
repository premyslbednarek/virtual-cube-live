import { drawAnotherCube, moveAnotherCube, moveAnotherCamera, removeCube, changeLayers, resetAnotherCube } from './main.js';
import { io } from './libs/socket.io.esm.min.js'

localStorage.debug = 'socket.io-client:socket'
let socket = io("localhost:8080")

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
    var pos = data[1];
    moveAnotherCamera(id, pos);
})

socket.on("opponentReset", function(data) {
    var id = data[0];
    resetAnotherCube(id);
})

function sendLayerChange(newLayers) {
    socket.emit("layersChange", newLayers);
}

function sendMove(move) {
    socket.emit("move", move);
}

function sendCamera(args) {
    socket.emit("camera", args);
}

function sendReset() {
    socket.emit("reset");
}

async function sendSolve(solve) {
    // socket.emit("solve", solve, (a) => console.log("dostal to", a));
    const response = socket.emitWithAck("solve", solve).then((response) => console.log("dostal jsem odpoved", response));
    // console.log("Move was inserted into the database with id:", await response);
    return response;
}
export {sendMove, sendCamera, sendLayerChange, sendReset, sendSolve, socket};