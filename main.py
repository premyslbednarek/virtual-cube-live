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

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

@app.route("/dev")
def dev():
    return render_template("test.html")

@app.route("/solve/<int:solve_id>")
def solve(solve_id):
    solve = db.session.get(Solve, solve_id)
    if solve is None:
        abort(404)

    q = select(SolveMove.move, SolveMove.since_start).where(SolveMove.solve_id == solve_id)
    moves = db.session.execute(q).all()

    camera_changes = db.session.execute(
        select(
            CameraChange.x,
            CameraChange.y,
            CameraChange.z,
            CameraChange.since_start
        ).where(
            CameraChange.solve_id == solve_id
        )
    ).all()

    print("SCRAMBLE", solve.scramble.scramble_string)
    return render_template(
        "solve.html",
        cube_size=solve.scramble.cube_size,
        scramble=solve.scramble.scramble_string,
        moves=list(map(lambda row: tuple(row), moves)),
        camera_changes=list(map(lambda row: tuple(row), camera_changes))
    )

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
    return render_template("login.html", text="register")


@app.route('/register', methods=["POST"])
def register_post():
    username: str = request.form['username']
    password: str = request.form['password']

    if not username or not password:
        flash("Enter both username and password.")
        return redirect(url_for("register"))

    # check whether an user with given username already exists
    q = select(func.count()).select_from(User).where(User.username == username)
    count: int = db.session.scalar(q)

    if count != 0:
        flash("User with entered username already exists.")
        return redirect(url_for("register"))

    # add new user to the database
    password_hash: str = generate_password_hash(password)
    new_user = User(username=username, password_hash=password_hash)
    db.session.add(new_user)
    db.session.commit()

    login_user(new_user, remember=True)
    return redirect("/")

@app.route('/login', methods=["GET"])
def login():
    return render_template("login.html", text="login")

@app.route('/login', methods=["POST"])
def login_post():
    username: str = request.form['username']
    password: str = request.form['password']

    q = select(User).where(User.username == username)
    user: User = db.session.scalar(q)

    # check whether user with given username exists and the password matches
    if user is None or not check_password_hash(user.password_hash, password):
        flash("Wrong username or password!")
        return redirect(url_for("login"))

    login_user(user, remember=True)
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

    # check whether the user has already joined the lobby
    q = select(func.count()).select_from(LobbyUser).where(LobbyUser.user_id == current_user.id, LobbyUser.lobby_id == lobby_id)
    res = db.session.scalar(q)
    if (res > 0):
        return {"code": 1}

    # add user to the lobby room
    print(current_user.username, "has joined lobby", lobby_id)
    join_room(lobby_id)

    connection_id = create_connection(3, None, lobby_id)

    # add connection to the database
    lobby_user = LobbyUser(
        lobby_id=lobby_id,
        user_id=current_user.id,
        current_connection_id=connection_id
    )
    db.session.add(lobby_user)
    db.session.commit()

    # fetch usernames of users in the room
    q = select(User.username).join(LobbyUser, User.id == LobbyUser.user_id).where(LobbyUser.lobby_id == lobby_id)
    usernames = db.session.scalars(q).all()

    # inform other users in the lobby about the connection
    socketio.emit(
        "lobby_connection",
        { "username": current_user.username },
        room=lobby_id,
        skip_sid=request.sid
    )

    return {"code": 0, "userList": usernames }

@socketio.on("ready")
def handle_ready(data):
    lobby_id: int = data["lobby_id"]
    username: str = current_user.username
    user_id: int = current_user.id

    print(username, "is ready in lobby", lobby_id)

    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.user_id == user_id)
    user: LobbyUser = db.session.scalars(q).one()

    user.status = LobbyUserStatus.READY
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

    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.user_id == user_id)
    user: LobbyUser = db.session.scalars(q).one()

    user.status = LobbyUserStatus.NOT_READY
    db.session.commit()

    socketio.emit(
        "unready",
        { "username": username },
        room=lobby_id,
        skip_sid=request.sid
    )

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



@socketio.on("startLobby")
def startLobby(data):
    lobby_id = data["lobby_id"]

    lobby: Lobby = db.session.get(Lobby, lobby_id)
    print(current_user.username, "wants to start lobby with id", lobby_id)

    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.user_id == current_user.id)
    user: LobbyUser = db.session.scalars(q).one()

    q = select(Lobby.creator_id).where(Lobby.id == lobby_id)
    creator_id: Lobby = db.session.scalars(q).one()

    if (user.role != LobbyRole.ADMIN and creator_id != current_user.id):
        print("Somebody else than the room admin and creator tried to start the match")
        return

    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id)
    users: List[LobbyUser] = db.session.scalars(q).all()

    racers_count = 0

    for user in users:
        if user.current_connection is not None:
            racers_count += 1
            if user.status != LobbyUserStatus.READY:
                print(user.user_id, "is not ready")
                return

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
            "scramble": scramble.scramble_string,
            "startTime": solve_startdate.isoformat()
        },
        room=lobby_id
    )
    print("everyone is ready, starting the match")

@socketio.on("lobby_move")
def lobby_move(data):
    now = datetime.now()
    lobby_id: int = data["lobby_id"]
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
            # skip_sid=request.sid
        )

    db.session.commit()


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



# @socketio.event
# def connect():
#     global i
#     print('connect ', request.sid)
#     connected_users = list(sidToName.values())
#     sidToName[request.sid] = i
#     i += 1
#     print("Sending welcoming message...")
#     socketio.emit("message", f"Welcome to the server. Your session user id is {sidToName[request.sid]}", to=request.sid)
#     socketio.emit("welcome", {"nUsers": len(sidToName) - 1, "usersIds": connected_users}, to=request.sid)
#     socketio.emit("message", f"User with session id {sidToName[request.sid]} has connected.", skip_sid=request.sid)
#     socketio.emit("connection", sidToName[request.sid], skip_sid=request.sid)
#     print("Welcoming message sent...")
#     print("pripojeni")

@socketio.event
def disconnect():
    print('disconnect ', request.sid)

    # handle lobby disconnections
    q = select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    conn: SocketConnection = db.session.scalars(q).one()

    conn.disconnection_date = func.now()
    db.session.commit()

    if conn.lobby_id is not None:
        socketio.emit(
            "lobby-disconnect",
            { "username": current_user.username },
            room=conn.lobby_id
        )


if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)