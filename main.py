from flask import Flask, request, send_from_directory, render_template, redirect, flash, url_for, jsonify
from flask_socketio import SocketIO, join_room, leave_room
from flask_login import LoginManager, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import json
from sqlalchemy import select
from model import db, Solve, User, Lobby, LobbyUsers, LobbyStatus
from pyTwistyScrambler import scrambler333, scrambler444
from cube import Cube
from typing import List
from enum import Enum

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db' # Using SQLite as the database
app.config['SECRET_KEY'] = "secret"

login_manager = LoginManager()
login_manager.init_app(app)

db.init_app(app)
with app.app_context():
    db.create_all()

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=False)

sidToName = {}
i = 0

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

@app.route("/dev")
def dev():
    return render_template("test.html")

@app.route("/solve/<int:solve_id>")
def solve(solve_id):
    solve = Solve.query.filter_by(id=solve_id).first()
    if solve is None:
        return "Solve with this ID does not exist"
    return render_template("solve.html", layers=solve.layers, solution=solve.solution, scramble=solve.scramble)

@app.route("/lobby")
def lobby_index():
    return render_template("lobby.html")

lobbies = {}
@app.route("/lobby/new")
def new_lobby():
    user_id = current_user.get_id()
    user = load_user(user_id)
    user_id = user_id if user else None
    lobby = Lobby(creator=user_id)
    db.session.add(lobby)
    db.session.commit()
    lobby_id = lobby.id
    return redirect(f"/lobby/{lobby_id}")

@app.route("/lobby/<int:lobby_id>")
def lobby(lobby_id):
    # check whether the user has already joined the lobby
    # q = LobbyUsers.query.filter_by(lobby_id=lobby_id).filter_by(user_id=current_user.id).first()
    # if (q):
    #     return "You have already joined this lobby!"

    # show start button only for the lobby creator
    q = select(Lobby.creator).filter_by(id=lobby_id)
    lobby_creator_id = db.session.execute(q).scalar()
    is_creator = lobby_creator_id == current_user.id

    return render_template("race.html", lobby_id=lobby_id, is_creator=is_creator)

@app.route('/')
def index():
    return render_template("index.html")
    # return send_from_directory("../client", "index.html")

@app.route('/js/<path:path>')
def js(path):
    return send_from_directory("../client/js", path)

@app.route('/register', methods=["GET"])
def register():
    return render_template("login.html", text="register")


@app.route('/register', methods=["POST"])
def register_post():
    username = request.form['username']
    password = request.form['password']
    hashed_password = generate_password_hash(password)

    if not username or not password:
        flash("insert both username and password")
        return redirect(url_for("register"))

    user = User.query.filter_by(username=username).first()
    print(user)
    if user:
        flash("user already exists")
        return redirect(url_for("register"))

    new_user = User(username=username,password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    login_user(new_user, remember=True)
    return redirect("/")

@app.route('/login', methods=["GET"])
def login():
    return render_template("login.html", text="login")

@app.route('/login', methods=["POST"])
def login_post():
    username = request.form['username']
    password = request.form['password']
    print(username)
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        login_user(user, remember=True)
        print("Logged in")
    else:
        flash("Wrong username or password")
        return redirect(url_for("login"))

    return redirect("/")

@app.route("/logout")
def logout():
    logout_user()
    return redirect("/")

@app.route('/style/<path:path>')
def style(path):
    return send_from_directory("../client/style", path)

@app.route('/leaderboard')
def leaderboard():
    solves = Solve.query.all()
    for solve in solves:
        print(solve)
    q = db.session.query(Solve, User).outerjoin(User, User.id == Solve.user_id).order_by(Solve.time)
    print("Query:", q)
    print("result", q.all())
    return render_template("leaderboard.html", solves=q)


@socketio.on('message')
def print_message(message):
    print("Socket ID: " , request.sid)
    print("Incoming message: ", message)
    socketio.emit("ack", "the server has gotten the message")


@socketio.on('ack')
def print_ack(message):
    print("ACK", message)
    print("The client has gotten the message.")

@socketio.on("move")
def distributeMove(message):
    socketio.emit("opponentMove", [sidToName[request.sid], message], skip_sid=request.sid)

@socketio.on("layersChange")
def distributeMove(newLayers):
    print(f"{sidToName[request.sid]} changed cube to {newLayers}x{newLayers}")
    socketio.emit("opponentLayers", [sidToName[request.sid], newLayers], skip_sid=request.sid)

@socketio.on("camera")
def distributeCamera(message):
    socketio.emit("opponentCamera", [sidToName[request.sid], message], skip_sid=request.sid)

@socketio.on("reset")
def distributeReset():
    socketio.emit("opponentReset", [sidToName[request.sid]], skip_sid=request.sid)

@socketio.on("uploadSolve")
def insertSolve(data):
    user_id = current_user.get_id()
    user = load_user(user_id)
    id = None
    if user:
        id = user.id

    solve = Solve(
        user_id=id,
        layers=data["layers"],
        scramble=json.dumps(data["scramble"]),
        solution=json.dumps(data["solution"]),
        time=data["timeString"]
    )
    db.session.add(solve)
    db.session.commit()
    # db.session.refresh(solve)
    return solve.id

@socketio.on("getSolve")
def getSolve(id):
    solve = Solve.query.filter_by(id=id).first()
    return { "scramble": solve.scramble, "solution": solve.solution }

@socketio.on("lobby_connection")
def handle_lobby_conection(data):
    lobby_id = data["lobby_id"]

    print(current_user.username, "has joined lobby", lobby_id)
    join_room(lobby_id)

    q = select(User.username).join(LobbyUsers, User.id == LobbyUsers.user_id).where(LobbyUsers.lobby_id == lobby_id)
    result = db.session.execute(q).all()

    # add connection to database
    cube = Cube(3)
    con = LobbyUsers(
        lobby_id=lobby_id,
        user_id=current_user.id,
        state=cube.serialize(),
        sid=request.sid,
        status=LobbyStatus.ACTIVE,
    )
    db.session.add(con)
    db.session.commit()

    socketio.emit(
        "lobby_connection",
        { "username": current_user.username },
        room=lobby_id,
        skip_sid=request.sid
    )

    return [res[0] for res in result]

@socketio.on("ready")
def handle_ready(data):
    lobby_id = data["lobby_id"]
    username = current_user.username
    user_id = current_user.id

    print(username, "is ready in lobby", lobby_id)

    user = LobbyUsers.query.filter_by(lobby_id=lobby_id).filter_by(user_id=user_id).first()
    user.ready = 1
    db.session.commit()

    socketio.emit(
        "ready",
        { "username": username },
        room=lobby_id,
        skip_sid=request.sid
    )

@socketio.on("unready")
def handle_ready(data):
    lobby_id = data["lobby_id"]
    username = current_user.username
    user_id = current_user.id

    print(username, "clicked unready in lobby", lobby_id)

    user = LobbyUsers.query.filter_by(lobby_id=lobby_id).filter_by(user_id=user_id).first()
    user.ready = 0
    db.session.commit()

    socketio.emit(
        "unready",
        { "username": username },
        room=lobby_id,
        skip_sid=request.sid
    )

@socketio.on("startLobby")
def startLobby(data):
    lobby_id = data["lobby_id"]
    print(current_user.username, "wants to start lobby with id", lobby_id)

    lobby = Lobby.query.filter_by(id=lobby_id).first()
    if (lobby.creator != current_user.id):
        print("Somebody else than the creator tried to start the match")
        return

    lobby_conns: List[LobbyUsers] = LobbyUsers.query.filter_by(lobby_id=lobby_id).all()
    print(lobby_conns)
    for conn in lobby_conns:
        print(conn.lobby_id)
        if conn.status == LobbyStatus.ACTIVE and conn.ready == 0:
            print(conn.user_id, "is not ready")
            return

    scramble = scrambler333.get_WCA_scramble()
    print(scramble)
    cube = Cube(3)
    cube.move(scramble)
    state = cube.serialize()
    lobby_conns = LobbyUsers.query.filter_by(lobby_id=lobby_id).all()
    for conn in lobby_conns:
        conn.state = state
    db.session.commit()

    socketio.emit(
        "match_start",
        { "state": state.decode("UTF-8") },
        room=lobby_id
    )
    print("everyone is ready, starting the match")

@socketio.on("lobby_move")
def lobby_move(data):
    lobby_id = data["lobby_id"]
    move = data["move"]

    socketio.emit(
        "lobby_move",
        { "username": current_user.username, "move": move},
        room=lobby_id,
        skip_sid=request.sid
    )

    res = LobbyUsers.query.filter_by(lobby_id = lobby_id).filter_by(user_id = current_user.id).first()
    print(res)
    cube = Cube(3, res.state)
    cube.move(move)
    # update cube state in db
    res.state = cube.serialize()
    db.session.commit()

    cube.pprint()
    print("state", cube.serialize())

    if cube.is_solved():
        print("solved!")
        socketio.emit(
            "solved",
            { "username": current_user.username },
            room=lobby_id,
            skip_sid=request.sid
        )

    print(current_user.username, "in lobby", lobby_id, "has made a ", move, "move")

@socketio.on("lobby_camera")
def lobby_camera(data):
    lobby_id = data["lobby_id"]
    position = data["position"]

    socketio.emit(
        "lobby_camera",
        { "username": current_user.username, "position": position },
        room=lobby_id,
        skip_sid=request.sid
    )


@socketio.event
def connect():
    global i
    print('connect ', request.sid)
    connected_users = list(sidToName.values())
    sidToName[request.sid] = i
    i += 1
    print("Sending welcoming message...")
    socketio.emit("message", f"Welcome to the server. Your session user id is {sidToName[request.sid]}", to=request.sid)
    socketio.emit("welcome", {"nUsers": len(sidToName) - 1, "usersIds": connected_users}, to=request.sid)
    socketio.emit("message", f"User with session id {sidToName[request.sid]} has connected.", skip_sid=request.sid)
    socketio.emit("connection", sidToName[request.sid], skip_sid=request.sid)
    print("Welcoming message sent...")
    print("pripojeni")

@socketio.event
def disconnect():
    print('disconnect ', request.sid)

    # handle lobby disconnections
    lobby_conns: List[LobbyUsers] = LobbyUsers.query.filter_by(sid = request.sid).all()
    for lobby_conn in lobby_conns:
        lobby_conn.status = LobbyStatus.DISCONNECTED
        db.session.commit()
        print("Lobby disconnection", current_user.username, "Lobbyid", lobby_conn.lobby_id)
        socketio.emit(
            "lobby-disconnect",
            { "username": current_user.username },
            room=lobby_conn.lobby_id
        )

    socketio.emit("message", f"User with session id {sidToName[request.sid]} has disconnected.")
    socketio.emit("disconnection", sidToName[request.sid])
    del sidToName[request.sid]


if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)