from flask import Flask, request, send_from_directory, render_template, redirect, flash, url_for, jsonify, abort
from flask_socketio import SocketIO, join_room, leave_room
from datetime import datetime, timedelta
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
import json
from sqlalchemy import select, func
from model import db, User, Lobby, LobbyUser, Scramble, Solve, Race, SocketConnection, CubeModel, SolveMove
from model import LobbyUserStatus, UserRole, LobbyRole, LobbyStatus, CameraChange
from pyTwistyScrambler import scrambler333, scrambler444, scrambler555, scrambler666, scrambler777
from cube import Cube
from typing import List
from enum import Enum
from time import sleep

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db3.db' # Using SQLite as the database
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

import time
@app.route('/api/time')
def get_current_time():
    return {'time': time.time()}

@app.route('/api/user_info')
def get_user_info():
    return {
        "isLogged": current_user.is_authenticated,
        "username": current_user.username if current_user.is_authenticated else ""
    }

@app.route("/api/get_lobbies")
def get_lobbies():
    q = select(User.username, Lobby.id).select_from(Lobby).join(User, Lobby.creator_id == User.id).order_by(Lobby.id.desc()).limit(10)
    res = db.session.execute(q).all();
    print()
    print("RESULT")
    print(res)
    print()
    data = []
    for creator, lobby_id in res:
        data.append({"creator": creator, "lobby_id": lobby_id})
    return {"data": data}

@app.route("/api/lobby_create")
@login_required
def api_lobby_create():
    lobby = Lobby(creator_id = current_user.id)
    db.session.add(lobby)
    db.session.commit()


    lobby_id: int = lobby.id

    socketio.emit(
        "lobby_add",
        {"creator": current_user.username, "lobby_id": lobby_id }
    )
    return { "lobby_id": lobby_id }

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

@app.route("/dev")
def dev():
    return render_template("test.html")

@app.route("/api/solve/<int:solve_id>")
def solve(solve_id: int):
    solve: Solve = db.session.get(Solve, solve_id)
    if solve is None:
        abort(404)

    moves_result = db.session.execute(
        select(
            SolveMove.move,
            SolveMove.since_start
        ).where(
            SolveMove.solve_id == solve_id
        )
    ).all()

    moves = [{"move": move, "sinceStart": sinceStart} for move, sinceStart in moves_result]

    camera_changes_result = db.session.execute(
        select(
            CameraChange.x,
            CameraChange.y,
            CameraChange.z,
            CameraChange.since_start
        ).where(
            CameraChange.solve_id == solve_id
        )
    ).all()

    camera_changes = [
        {"x": x, "y": y, "z": z, "sinceStart": sinceStart}
        for x, y, z, sinceStart in camera_changes_result
    ]

    return {
        "cube_size": solve.scramble.cube_size,
        "scramble": solve.scramble.scramble_string,
        "scramble_state": solve.scramble.cube_state.decode("UTF-8"),
        "moves": moves,
        "camera_changes": camera_changes,
        "completed": solve.completed,
        "time": solve.time
    }

@app.route("/lobby/")
def lobby_index():
    return render_template("lobby.html")

@app.route("/lobby/new")
@login_required
def lobby_create():
    lobby = Lobby(creator_id = current_user.id)
    db.session.add(lobby)
    db.session.commit()

    lobby_id: int = lobby.id
    return redirect(f"/lobby/{lobby_id}")

@app.route("/lobby/<int:lobby_id>")
@login_required
def lobby_join(lobby_id: int):
    # # show start button only for the lobby creator
    q = select(Lobby.creator_id).filter_by(id=lobby_id)
    lobby_creator_id = db.session.execute(q).scalar()
    is_creator = int(lobby_creator_id == current_user.id)

    return render_template("race.html", lobby_id=lobby_id, is_creator=is_creator)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/js/<path:path>')
def js(path):
    return send_from_directory("../client/js", path)

@app.route('/register', methods=["GET"])
def register():
    return render_template("register.html")


@app.route('/register', methods=["POST"])
def register_post():
    data = json.loads(request.data)
    print(data)
    username: str = data['username']
    password: str = data['password']

    if not username or not password:
        flash("Enter both username and password.")
        return redirect(url_for("register"))

    # check whether an user with given username already exists
    q = select(func.count()).select_from(User).where(User.username == username)
    count: int = db.session.scalar(q)

    if count != 0:
        flash("User with entered username already exists.")
        return "bad", 404

    # add new user to the database
    password_hash: str = generate_password_hash(password)
    new_user = User(username=username, password_hash=password_hash)
    db.session.add(new_user)
    db.session.commit()

    login_user(new_user, remember=True)
    print("registration success")
    return "ok", 200

@app.route('/login', methods=["GET"])
def login():
    return render_template("login.html", text="login")

@app.route('/login', methods=["POST"])
def login_post():
    data = json.loads(request.data)
    print(data)
    username: str = data['username']
    password: str = data['password']

    q = select(User).where(User.username == username)
    user: User = db.session.scalar(q)

    # check whether user with given username exists and the password matches
    if user is None or not check_password_hash(user.password_hash, password):
        flash("Wrong username or password!")
        return "Wrong username or password", 400

    login_user(user, remember=True)
    print("Login succesfull")
    return {"status": 200 }

@app.route("/logout")
@login_required
def logout():
    print(current_user.username, "logged out")
    logout_user()
    return "ok", 200

@app.route('/style/<path:path>')
def style(path):
    return send_from_directory("../client/style", path)

@app.route('/leaderboard')
def leaderboard():
    result = db.session.execute(
        select(
            User.username,
            User.id,
            Solve.id,
            Solve.time,
            Solve.race_id
        ).select_from(
            Solve
        ).where(
            Solve.completed == True
        )
    ).all()
    print(result)
    return render_template("leaderboard.html", solves=list(map(tuple, result)))


# @socketio.on('message')
# def print_message(message):
#     print("Socket ID: " , request.sid)
#     print("Incoming message: ", message)
#     socketio.emit("ack", "the server has gotten the message")


# @socketio.on('ack')
# def print_ack(message):
#     print("ACK", message)
#     print("The client has gotten the message.")

# @socketio.on("move")
# def distributeMove(message):
#     socketio.emit("opponentMove", [sidToName[request.sid], message], skip_sid=request.sid)

# @socketio.on("layersChange")
# def distributeMove(newLayers):
#     print(f"{sidToName[request.sid]} changed cube to {newLayers}x{newLayers}")
#     socketio.emit("opponentLayers", [sidToName[request.sid], newLayers], skip_sid=request.sid)

# @socketio.on("camera")
# def distributeCamera(message):
#     socketio.emit("opponentCamera", [sidToName[request.sid], message], skip_sid=request.sid)

# @socketio.on("reset")
# def distributeReset():
#     socketio.emit("opponentReset", [sidToName[request.sid]], skip_sid=request.sid)

# @socketio.on("uploadSolve")
# def insertSolve(data):
#     user_id = current_user.get_id()
#     user = load_user(user_id)
#     id = None
#     if user:
#         id = user.id

#     solve = Solve(
#         user_id=id,
#         layers=data["layers"],
#         scramble=json.dumps(data["scramble"]),
#         solution=json.dumps(data["solution"]),
#         time=data["timeString"]
#     )
#     db.session.add(solve)
#     db.session.commit()
#     # db.session.refresh(solve)
#     return solve.id

# @socketio.on("getSolve")
# def getSolve(id):
#     solve = Solve.query.filter_by(id=id).first()
#     return { "scramble": solve.scramble, "solution": solve.solution }

def create_connection(size, cube_id=None, lobby_id=None):
    default_state = Cube(size).serialize()

    # if no cube_id is provided, create a new cube entity
    if cube_id is None:
        cube_entity = CubeModel(
            size=size,
            state=default_state
        )
        db.session.add(cube_entity)
        db.session.commit()
        cube_id = cube_entity.id

    connection = SocketConnection(
        socket_id=request.sid,
        user_id=current_user.id,
        cube_id=cube_id,
        lobby_id=lobby_id,
    )

    db.session.add(connection)
    db.session.commit()

    return connection.id


@socketio.on("lobby_connect")
def handle_lobby_conection(data):
    lobby_id: int = int(data["lobby_id"])
    print("LOBBY CONNECTION", lobby_id, current_user.username)

    # check whether the user has already joined the lobby
    q = select(LobbyUser).where(LobbyUser.user_id == current_user.id, LobbyUser.lobby_id == lobby_id)
    lobbyuser: LobbyUser | None = db.session.scalars(q).one_or_none()
    if (lobbyuser and lobbyuser.current_connection_id):
        return {"code": 1}

    # add user to the lobby room
    join_room(lobby_id)

    connection_id = create_connection(3, None, lobby_id)

    lobby: Lobby = db.session.get(Lobby, lobby_id)
    is_admin: bool = lobby.creator_id == current_user.id

    # add connection to the database
    if not lobbyuser:
        lobbyuser = LobbyUser(
            lobby_id=lobby_id,
            user_id=current_user.id,
        )
        db.session.add(lobbyuser)
        db.session.commit()

    lobbyuser.current_connection_id=connection_id
    db.session.commit()

    # fetch usernames of users in the room
    q = select(User.username).join(LobbyUser, User.id == LobbyUser.user_id).where(LobbyUser.lobby_id == lobby_id, User.username != current_user.username)
    usernames = db.session.scalars(q).all()

    # inform other users in the lobby about the connection
    socketio.emit(
        "lobby_connection",
        { "username": current_user.username },
        room=lobby_id,
        skip_sid=request.sid
    )

    return {"code": 0, "userList": usernames, "isAdmin": is_admin }

@socketio.on("lobby_ready_status")
def send_ready_status(data):
    lobby_id: int = int(data["lobby_id"])
    ready_status: bool = data["ready_status"]

    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.user_id == current_user.id)
    user: LobbyUser = db.session.scalars(q).one()

    user.status = LobbyUserStatus.READY if ready_status else LobbyUserStatus.NOT_READY
    db.session.commit()

    socketio.emit(
        "lobby_ready_status_",
        {"ready_status": ready_status, "username": current_user.username},
        room=lobby_id,
        skip_sid=request.sid
    )

    print(lobby_id, ready_status)

def create_scramble(size: int) -> Scramble:
    scramble_string: str = scrambler333.get_WCA_scramble()

    cube = Cube(size)
    cube.move(scramble_string)

    scramble = Scramble(
        cube_size=size,
        scramble_string=scramble_string,
        cube_state=cube.serialize()
    )

    db.session.add(scramble)
    db.session.commit()

    return scramble


@socketio.on("lobby_start")
def lobby_start_request(data):
    lobby_id = int(data["lobby_id"])
    force = bool(data["force"])

    print(current_user.username, "wants to start lobby with id:", lobby_id)

    lobby: Lobby = db.session.get(Lobby, lobby_id)

    # check whether the user is the lobby creator or admin of the lobby
    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.user_id == current_user.id)
    user: LobbyUser = db.session.scalars(q).one()

    if (user.role != LobbyRole.ADMIN and lobby.creator_id != current_user.id):
        print("Somebody else than the room admin and creator tried to start the match")
        return

    # check whether all connected users are ready
    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id)
    users: List[LobbyUser] = db.session.scalars(q).all()

    racers_count = 0

    for user in users:
        if user.current_connection is not None:
            racers_count += 1
            if not force and user.status != LobbyUserStatus.READY:
                print(user.user_id, "is not ready")
                return

    # everybody is ready, start the race
    scramble: Scramble = create_scramble(lobby.cube_size)

    race = Race(
        scramble_id=scramble.id,
        lobby_id=lobby_id,
        lobby_seq=lobby.races_finished,
        racers_count=racers_count
    )

    db.session.add(race)
    db.session.commit()

    now = datetime.now()
    solve_startdate: datetime = now + timedelta(seconds=3)

    for user in users:
        if (user.current_connection is None):
            continue


        solve = Solve(
            scramble_id=scramble.id,
            user_id = user.user_id,
            race_id=race.id,
            inspection_startdate=now,
            solve_startdate=solve_startdate
        )

        db.session.add(solve)
        db.session.commit()

        user.current_connection.cube.current_solve_id = solve.id
        user.current_connection.cube.state = scramble.cube_state

        user.status = LobbyUserStatus.SOLVING

    db.session.commit()

    socketio.emit(
        "match_start",
        {
            "state": scramble.cube_state.decode("UTF-8"),
            "startTime": solve_startdate.isoformat()
        },
        room=lobby_id
    )

    print("starting the match...")

@socketio.on("lobby_move")
def lobby_move(data):
    now = datetime.now()
    lobby_id: int = int(data["lobby_id"])
    move: str = data["move"]

    print(current_user.username, "in lobby", lobby_id, "has made a ", move, "move")

    socketio.emit(
        "lobby_move",
        { "username": current_user.username, "move": move},
        room=lobby_id,
        skip_sid=request.sid
    )

    q = select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    connection: SocketConnection = db.session.scalar(q)

    cube_entity: CubeModel = connection.cube
    solve: Solve = cube_entity.current_solve

    if solve and solve.completed:
        print("Move in a done solve, ignoring")
        return

    if solve and now <= solve.solve_startdate and move not in ["x", "x'", "y", "y'", "z", "z'"]:
        print("move during inspection, ignoring")
        return


    cube = Cube(cube_entity.size, cube_entity.state)
    cube.move(move)

    is_solved = cube.is_solved()

    cube.pprint()

    cube_entity.state = cube.serialize()
    db.session.commit()

    if cube_entity.current_solve is None:
        # there is no current solve
        return

    solve.moves += " " + move

    time_delta: datetime.timedelta = now - solve.solve_startdate
    time_delta_ms = time_delta / timedelta(milliseconds=1)

    move = SolveMove(
        move=move,
        solve_id=solve.id,
        timestamp=now,
        since_start = time_delta_ms
    )

    db.session.add(move)
    db.session.commit()

    if is_solved:
        solve.completed = True

        solve.time = time_delta_ms

        q = select(LobbyUser).where(LobbyUser.user_id==current_user.id, LobbyUser.lobby_id==lobby_id)
        user: LobbyUser = db.session.scalars(q).one()
        user.status = LobbyUserStatus.SOLVED

        socketio.emit(
            "solved",
            { "username": current_user.username },
            room=lobby_id,
            skip_sid=request.sid
        )

        socketio.emit(
            "you_solved",
            room=lobby_id,
            to=request.sid
        )

    db.session.commit()


@socketio.on("lobby_camera")
def lobby_camera(data):
    lobby_id = int(data["lobby_id"])
    position = data["position"]

    socketio.emit(
        "lobby_camera",
        { "username": current_user.username, "position": position },
        room=lobby_id,
        skip_sid=request.sid
    )

    q = select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    connection: SocketConnection = db.session.scalar(q)

    cube_entity: CubeModel = connection.cube
    solve: Solve = cube_entity.current_solve

    if solve is not None:
        now = datetime.now()
        time_delta: datetime.timedelta = now - solve.solve_startdate
        time_delta_ms = time_delta / timedelta(milliseconds=1)

        obj = CameraChange(
            timestamp=now,
            since_start=time_delta_ms,
            solve_id=solve.id,
            x=position["x"],
            y=position["y"],
            z=position["z"]
        )
        db.session.add(obj)
        db.session.commit()


@socketio.event
def connect():
    print()
    print("SOCKET CONNECTION!")
    print(request.sid)

@socketio.event
def disconnect():
    print()
    print("SOCKET DC")
    print(request.sid)

    # handle lobby disconnections
    q = select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    conn: SocketConnection = db.session.scalars(q).one()

    if conn.lobby_id is not None:
        print("Lobby disconnection", conn.lobby_id, current_user.username)
        q = select(LobbyUser).where(LobbyUser.user_id == conn.user_id, LobbyUser.lobby_id == conn.lobby_id)
        lobby_user: LobbyUser = db.session.scalar(q)
        lobby_user.current_connection_id = None

        leave_room(conn.lobby_id)

        socketio.emit(
            "lobby_disconnection",
            { "username": current_user.username },
            room=conn.lobby_id
        )


    conn.disconnection_date = func.now()
    db.session.commit()

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)