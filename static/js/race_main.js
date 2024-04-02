import { io } from '/static/js/libs/socket.io.esm.min.js';
import Cube from '/static/js/cube_new.js';
import { Timer, CountdownTimer } from '/static/js/timer.js'

const timeElement = document.getElementById("timer");

const timer = new Timer(timeElement);
const countdownTimer = new CountdownTimer(timeElement);

class UserHandler {
    constructor() {
        this.users = new Map();
    }

    add(username, canvas=null) {
        if (!this.users.has(username)) {
            const user = new User(username, canvas);
            this.users.set(username, user);
            return user;
        }
    }

    get(username) {
        return this.users.get(username);
    }

    remove(username) {
        this.users.delete(username);
    }

    forEach(fun) {
        for (const [_, user] of this.users) {
            fun(user);
        }
    }

    all(fun) {
        for (const [_, user] of this.users) {
            if (!fun(user)) {
                return false;
            }
        }
        return true;
    }
}

class User {
    constructor(username, canvas) {
        this.username = username;
        this.ready = false;

        const userList = document.getElementById("userList");
        this.userInfoDiv = document.createElement("div");
        userList.appendChild(this.userInfoDiv);

        this.canvasInfo = null;
        if (canvas == null) {
            this.canvasDiv = document.createElement("div");
            this.canvasDiv.style = "position: relative";
            document.getElementById("otherCanvases").appendChild(this.canvasDiv);

            canvas = document.createElement("canvas");
            canvas.style = "width: 100%; height: 250px"

            this.canvasInfo = document.createElement("div");
            this.canvasInfo.style = "position: absolute; top: 0; left: 0; color: white;"
            this.canvasDiv.appendChild(this.canvasInfo);
            this.canvasDiv.appendChild(canvas);
        }

        this.cube = new Cube(3, canvas);
        this.solved = false;
        this.renderTag();
    }

    renderTag() {
        let string = `${this.username} is `;
        string += (this.ready) ? "ready" : "not ready";
        const color = (this.ready) ? "green" : "red";

        this.userInfoDiv.innerHTML = string;
        this.userInfoDiv.style.color = color;
        if (this.canvasInfo != null) {
            this.canvasInfo.innerHTML = string;
            this.canvasInfo.style.color = color;
        }
    }

    toggleReady() {
        this.ready = !this.ready;
        this.renderTag();
    }

    setReady(ready) {
        this.ready = ready;
        this.renderTag();
    }
}

const socket = io();
console.log("our username", ourUsername);


const users = new UserHandler();
const mainCanvas = document.getElementById("mainCanvas");

const me = users.add(ourUsername, mainCanvas);
me.cube.init_camera_controls();
me.cube.init_keyboard_controls();
me.cube.init_mouse_moves();

function send_move(move_str) {
    const data = {
        lobby_id: lobby_id,
        move: move_str
    }
    socket.emit("lobby_move", data);
}

function send_camera(new_position) {
    const data = {
        lobby_id: lobby_id,
        position: new_position
    }
    socket.emit("lobby_camera", data);
}

me.cube.onMove(send_move);
me.cube.onCamera(send_camera);

socket.on("lobby_move", function(data) {
    const username = data.username;
    const move = data.move;

    const user = users.get(username);
    user.cube.makeMove(move, false);
})

socket.on("lobby_camera", function(data) {
    const username = data.username;
    const position = data.position;

    const user = users.get(username);
    user.cube.updateCamera(position);
})

function updateReady() {
    const allReady = users.all(u => u.ready);
    console.log("All readt:", allReady);
    // {% if is_creator %}
    // document.getElementById("startButton").disabled = !allReady;
    // {% endif %}
}

const readyButton = document.getElementById("readyButton");
readyButton.addEventListener("click", () => {
    if (!me.ready) {
        socket.emit("ready", { lobby_id: lobby_id })
        readyButton.innerHTML = "unready";
        me.setReady(true);
        updateReady();
    } else {
        socket.emit("unready", { lobby_id: lobby_id })
        readyButton.innerHTML = "ready";
        me.setReady(false);
        updateReady();
    }
});

socket.on("ready", function(data) {
    const username = data.username;
    users.get(username).setReady(true);
    updateReady();
});

socket.on("unready", function(data) {
    const username = data.username;
    users.get(username).setReady(false);
    updateReady();
})

// {% if is_creator %}
//     const startButton = document.getElementById("startButton")
//     startButton.addEventListener("click", () => {
//         socket.emit("startLobby", { lobby_id: lobby_id});
//     })
// {% endif %}

// connect to this lobby
socket.emit("lobby_connect", { lobby_id: lobby_id }, function(data) {
    const status = data.code
    if (status == 1) {
        alert("You have already joined this lobby.");
        return;
    }

    const userList = data.userList
    userList.forEach((user) => { users.add(user)});
})


socket.on("lobby_connection", function(data) {
    console.log(data)
    users.add(data.username);
})

socket.on("lobby-disconnect", function(data) {
    const username = data.username;
    console.log(username, "has left the lobby");

    const user = users.get(username);
    user.canvasDiv.remove();
})

// !! DONT FORGET TO REMOVE !!
let scramble = "";

socket.on("match_start", function(data) {
    const state = data.state;
    const startTime = data.startTime;

    users.forEach(user => user.cube.setState(state));
    // !! DONT FORGET TO REMOVE !!
    scramble = data.scramble;

    me.cube.startInspection();
    const START_MS = 3000;
    countdownTimer.start(new Date(startTime));
    // timerElement.innerHTML = START_SECONDS;
    countdownTimer.onTarget(() => {
        me.cube.startSolve();
        // timer.reset();
        timer.start();
    })

    readyButton.disabled = true;
    // {% if is_creator %}
    // document.getElementById("startButton").disabled = true;
    // {% endif %}
})

// !! DONT FORGET TO REMOVE !!
const solveButton = document.getElementById("solveButton");
solveButton.addEventListener("click", async function(e) {
    const moves = scramble.split(" ");
    const cube = users.get(ourUsername).cube;
    for (let i = moves.length - 1; i >= 0; --i) {
        const move = moves[i];
        for (let j = 0; j < 3; j++) {
            await new Promise(r => setTimeout(r, 150));
            cube.makeMove(move);
        }
    }
});

socket.on("solved", async function(data) {
    const username = data.username
    const user = users.get(username);
    const cube = user.cube;

    if (username == ourUsername) {
        timer.stop();
    }

    cube.solved = true;
    if (users.all(user => user.cube.solved)) {
        users.forEach(user => {
            user.setReady(false);
            user.solved = false;
        })
        readyButton.innerHTML = "ready";
        console.log("all solved");

        readyButton.disabled = false;
        // {% if is_creator %}
        // document.getElementById("startButton").disabled = true;
        // {% endif %}
    }
    // flash green color in the background of the solved cube
    user.cube.renderer.setClearColor(0x4feb34, 1);
    user.cube.render();

    await new Promise(r => setTimeout(r, 1000));
    user.cube.renderer.setClearColor(0x000000, 1);
    user.cube.render();
})
