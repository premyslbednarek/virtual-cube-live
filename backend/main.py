import eventlet
import time
eventlet.monkey_patch()
from flask import Flask, request, send_from_directory, render_template, redirect, flash, url_for, jsonify, abort, copy_current_request_context
from threading import Thread
from flask_socketio import SocketIO, join_room, leave_room, rooms
from datetime import datetime, timedelta
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
import json
from sqlalchemy import select, func
from model import db, User, Lobby, LobbyUser, Scramble, Solve, Race, SocketConnection, CubeEntity, SolveMove
from model import LobbyUserStatus, UserRole, LobbyRole, LobbyStatus, CameraChange
from pyTwistyScrambler import scrambler333, scrambler444, scrambler555, scrambler666, scrambler777, scrambler222
from cube import Cube
from typing import List
from enum import Enum
from typing import TypedDict, Tuple
from eventlet import sleep
from dotenv import load_dotenv
import os
load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.db' # Using SQLite as the database
app.config['SECRET_KEY'] = "secret"

PRODUCTION = "prod"
mode = os.environ.get("MODE", PRODUCTION)
print(mode)

login_manager = LoginManager()
login_manager.init_app(app)

db.init_app(app)
with app.app_context():
    db.create_all()

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=False)

sidToName = {}
i = 0

class RequestSolutionData(TypedDict):
    lobby_id: int

@app.route('/api/user/<int:user_id>')
def get_user(user_id: int):
    row = db.session.execute(
        select(
            User.username,
            User.role,
            User.created_date
        ).where(User.id == user_id)
    ).one_or_none()

    if row is None:
        return abort(404)

    username, role, created_date = row._tuple()

    solves = db.session.execute(
        select(
            Solve.id,
            Solve.completed,
            Solve.time,
            Solve.race_id,
            Scramble.cube_size
        ).select_from(
            Solve
        ).join(
            Scramble, Solve.scramble_id == Scramble.id
        ).where(
            Solve.user_id == user_id
        )
    ).all()
    print(solves, type(solves))

    return {
        "username": username,
        "role": "user" if role == UserRole.USER else "admin",
        "created_date": created_date,
        "solves": [solve._asdict() for solve in solves]
    }

@socketio.on("get_solution")
def get_solution():
    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )
    if connection is None:
        return

    solve = connection.cube.current_solve
    if solve is None:
        return

    moves = list(map(lambda move: move["move"], solve.get_moves()))
    allmoves = solve.scramble.scramble_string.split() + moves
    return {"moves_done": allmoves}

@app.route('/api/request_solution', methods=["POST"])
def handle_solution_request():
    if (mode == PRODUCTION and current_user.role != UserRole.ADMIN):
        return abort(405)

    data: RequestSolutionData = json.loads(request.data)

    lobby_user: LobbyUser = db.session.scalar(
        select(LobbyUser)
            .where(LobbyUser.lobby_id == data["lobby_id"], LobbyUser.user_id == current_user.id)
    )

    solve = lobby_user.current_connection.cube.current_solve
    if (solve is None):
        abort(404)

    # moves = db.session.scalars(
    #     select(SolveMove.move)
    #         .where(SolveMove.solve_id == solve.id)
    #         .order_by(SolveMove.timestamp.asc())
    # ).all()

    moves = list(map(lambda move: move["move"], solve.get_moves()))

    allmoves = solve.scramble.scramble_string.split() + moves

    return {"moves_done": allmoves}


import time
@app.route('/api/time')
def get_current_time():
    return {'time': time.time()}

@app.route('/api/user_info')
def get_user_info():
    return {
        "isLogged": current_user.is_authenticated,
        "username": current_user.username if current_user.is_authenticated else "",
        "isAdmin": current_user.is_authenticated and current_user.role == UserRole.ADMIN
    }

@app.route("/api/get_lobbies")
def get_lobbies():
    res = db.session.execute(
        select(
            User.username,
            Lobby.id)
        .select_from(
            Lobby
        ).where(
            Lobby.private == False,
            Lobby.status != LobbyStatus.ENDED
        ).join(
            User, Lobby.creator_id == User.id
        ).order_by(Lobby.id.desc()).limit(20)

    ).all();
    print()
    print("RESULT")
    print(res)
    print()
    data = []
    for creator, lobby_id in res:
        data.append({"creator": creator, "lobby_id": lobby_id})
    return {"data": data}

class LobbyCreateData(TypedDict):
    layers: int
    private: bool
    waitTime: int

class LobbyCreateResponse(TypedDict):
    lobby_id: int

@app.route("/api/lobby_create", methods=["POST"])
@login_required
def api_lobby_create() -> LobbyCreateResponse:
    data: LobbyCreateData = json.loads(request.data)
    lobby = Lobby(
        creator_id = current_user.id,
        private=data["private"],
        cube_size=data["layers"],
        wait_time=data["waitTime"]
    )
    db.session.add(lobby)
    db.session.commit()

    # if lobby is not private, show it on homepage
    if not data["private"]:
        socketio.emit(
            "lobby_add",
            {"creator": current_user.username, "lobby_id": lobby.id }
        )

    return { "lobby_id": lobby.id }

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

@app.route("/api/solve/<int:solve_id>")
def solve(solve_id: int):
    solve: Solve = db.session.get(Solve, solve_id)
    if solve is None:
        abort(404)

    # moves_result = db.session.execute(
    #     select(
    #         SolveMove.move,
    #         SolveMove.since_start
    #     ).where(
    #         SolveMove.solve_id == solve_id
    #     )
    # ).all()

    # moves = [{"move": move, "sinceStart": sinceStart} for move, sinceStart in moves_result]

    # camera_changes_result = db.session.execute(
    #     select(
    #         CameraChange.x,
    #         CameraChange.y,
    #         CameraChange.z,
    #         CameraChange.since_start
    #     ).where(
    #         CameraChange.solve_id == solve_id
    #     )
    # ).all()

    # camera_changes = [
    #     {"x": x, "y": y, "z": z, "sinceStart": sinceStart}
    #     for x, y, z, sinceStart in camera_changes_result
    # ]

    return {
        "cube_size": solve.scramble.cube_size,
        "scramble": solve.scramble.scramble_string,
        "scramble_state": solve.scramble.cube_state.decode("UTF-8"),
        "moves": solve.get_moves(),
        "camera_changes": solve.get_camera_changes(),
        "completed": solve.completed,
        "time": solve.time
    }

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

def create_connection(size, cube_id=None, lobby_id=None):
    default_state = Cube(size).serialize()

    # if no cube_id is provided, create a new cube entity
    if cube_id is None:
        cube_entity = CubeEntity(
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

@socketio.on("solo_join")
def handle_solo_join(data):
    create_connection(data["cubeSize"])

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

    lobby: Lobby = db.session.get(Lobby, lobby_id)
    is_admin: bool = lobby.creator_id == current_user.id

    connection_id = create_connection(lobby.cube_size, None, lobby_id)

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
    users = db.session.execute(
        select(
            User.username,
            LobbyUser.status == LobbyUserStatus.READY,
            LobbyUser
        ).join(
            LobbyUser, User.id == LobbyUser.user_id
        ).where(
            LobbyUser.lobby_id == lobby_id, User.username != current_user.username
        )
    ).all()

    # inform other users in the lobby about the connection
    socketio.emit(
        "lobby_connection",
        { "username": current_user.username, "points": lobbyuser.points },
        room=lobby_id,
        skip_sid=request.sid
    )

    return {
        "code": 0,
        "userList": [(username, ready, lobbyuser.current_connection.cube.state.decode("UTF-8")) for username, ready, lobbyuser in users],
        "isAdmin": is_admin,
        "cubeSize": lobby.cube_size,
        "points": get_lobby_points(lobby_id)
    }

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

scrambler_dispatch = {
    2: scrambler222,
    3: scrambler333,
    4: scrambler444,
    5: scrambler555,
    6: scrambler666,
    7: scrambler777
}
def create_scramble(size: int) -> Scramble:
    scramble_string: str = scrambler_dispatch[size].get_WCA_scramble()

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

INSPECTION_LENGTH_SECONDS = 3

@socketio.on("solo_solve_start")
def solo_solve_start():
    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )
    if connection is None:
        return

    scramble: Scramble = create_scramble(connection.cube.size)

    now = datetime.now()

    solve = Solve(
        scramble_id=scramble.id,
        user_id = current_user.id,
        inspection_startdate=now,
        solve_startdate=now + timedelta(seconds=INSPECTION_LENGTH_SECONDS)
    )

    db.session.add(solve)
    db.session.commit()

    solve.start_session(now + timedelta(seconds=INSPECTION_LENGTH_SECONDS))

    connection.cube.current_solve_id = solve.id
    connection.cube.state = scramble.cube_state

    db.session.commit()

    print("returning state", scramble.cube_state)
    return {
        "state": scramble.cube_state.decode("UTF-8")
    }


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
    solve_startdate: datetime = now + timedelta(seconds=INSPECTION_LENGTH_SECONDS)

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

        solve.start_session(now + timedelta(seconds=INSPECTION_LENGTH_SECONDS))

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

class LobbyPoints(TypedDict):
    username: str
    points: int


def get_lobby_points(lobby_id: int) -> List[LobbyPoints]:
    res = db.session.execute(
        select(User.username, LobbyUser.points)
            .select_from(LobbyUser)
            .join(User, User.id == LobbyUser.user_id)
            .where(LobbyUser.lobby_id == lobby_id)
            .order_by(LobbyUser.points.desc())
    )
    return [{"username": username, "points": points} for username, points in res]

def end_current_race(lobby_id: int) -> None:
    race: Race = db.session.scalar(
        select(Race).where(Race.lobby_id == lobby_id, Race.ongoing)
    )

    solves = db.session.scalars(
        select(Solve).where(Solve.race_id == race.id)
    )

    for solve in solves:
        if solve.is_ongoing():
            solve.end_current_session(datetime.now())

    res = db.session.execute(
        select(User.id, User.username, Solve.time, Solve.completed)
            .select_from(Solve)
            .join(User, User.id == Solve.user_id)
            .where(Solve.race_id == race.id)
            .order_by(Solve.time.asc())
    )

    points = 10
    results = []
    for id, username, time, completed in res:
        print(id, username, time, points)
        if not completed:
            results.append({"username": username, "time": None, "pointsDelta": 0})
        else:
            results.append({"username": username, "time": time, "pointsDelta": points})
            lobbyuser: LobbyUser = db.session.scalar(
                select(LobbyUser).where(LobbyUser.user_id == id, LobbyUser.lobby_id == lobby_id)
            )
            lobbyuser.points = lobbyuser.points + points
            points -= 1


    print("rooms", rooms())
    print("emmitting", lobby_id)
    socketio.emit(
        "lobby_race_done",
        {"results": results, "lobbyPoints": get_lobby_points(lobby_id)},
        room=lobby_id
    )
    race.ongoing = False
    db.session.commit()


def check_race_done(lobby_id: int) -> None:
    # get number of users in the lobby that are still solving the cube
    still_solving: int = db.session.scalar(
        select(func.count()).select_from(LobbyUser).where(LobbyUser.lobby_id == lobby_id, LobbyUser.current_connection_id is not None, LobbyUser.status == LobbyUserStatus.SOLVING)
    )

    if (still_solving == 0):
        print(f"race in lobby {lobby_id} is over")
        end_current_race(lobby_id)


@socketio.on("lobby_move")
def lobby_move(data):
    now = datetime.now()
    # lobby_id: int = int(data["lobby_id"])
    move: str = data["move"]

    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )

    if connection is None:
        print("connection is none")
        return

    lobby_id = connection.lobby_id

    print(current_user.username, "in lobby", lobby_id, "has made a ", move, "move")

    if lobby_id:
        socketio.emit(
            "lobby_move",
            { "username": current_user.username, "move": move},
            room=lobby_id,
            skip_sid=request.sid
        )


    cube_entity: CubeEntity = connection.cube
    solve: Solve = cube_entity.current_solve

    if solve and solve.completed:
        print("Move in a done solve, ignoring")
        return

    if solve and now <= solve.solve_startdate and move not in ["x", "x'", "y", "y'", "z", "z'"]:
        print("move during inspection, ignoring")
        return


    cube_entity.make_move(move, now)

    if not lobby_id and solve.completed:
        socketio.emit(
            "completed",
            {"time": solve.time },
            to=request.sid
        )

    if lobby_id and solve and solve.completed:
        lobby_user = db.session.scalar(
            select(LobbyUser).where(LobbyUser.user_id==current_user.id, LobbyUser.lobby_id==lobby_id)
        )
        lobby_user.status = LobbyUserStatus.SOLVED

        lobby = db.session.get(Lobby, lobby_id)
        current_race: Race = db.session.scalar(
            select(Race).where(Race.lobby_id == lobby_id, Race.ongoing)
        )

        @copy_current_request_context
        def end_race_if_not_ended(race_id: int, lobby_id: int, delay: int):
            time.sleep(delay)

            race = db.session.get(Race, race_id)
            if race.ongoing:
                end_current_race(lobby_id)

        if current_race.finishers_count == 0:
            socketio.emit(
                "start_countdown",
                { "waitTime": lobby.wait_time },
                room=lobby_id
            )
            socketio.start_background_task(target=end_race_if_not_ended, race_id=current_race.id, lobby_id=lobby_id, delay=lobby.wait_time)

        current_race.finishers_count = current_race.finishers_count + 1

        socketio.emit(
            "solved",
            { "username": current_user.username, "time": solve.time },
            room=lobby_id,
            skip_sid=request.sid
        )

        socketio.emit(
            "you_solved",
            { "time": solve.time },
            room=lobby_id,
            to=request.sid
        )

        check_race_done(lobby_id)

    db.session.commit()


@socketio.on("lobby_camera")
def lobby_camera(data):
    position = data["position"]

    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )

    if connection is None:
        print("connection is none")
        return

    lobby_id = connection.lobby_id

    if lobby_id:
        socketio.emit(
            "lobby_camera",
            { "username": current_user.username, "position": position },
            room=lobby_id,
            skip_sid=request.sid
        )

    cube_entity: CubeEntity = connection.cube
    solve: Solve = cube_entity.current_solve

    if solve:
        solve.add_camera_change(position["x"], position["y"], position["z"], datetime.now())


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
        db.session.commit()

        leave_room(conn.lobby_id)

        socketio.emit(
            "lobby_disconnection",
            { "username": current_user.username },
            room=conn.lobby_id
        )

        # check after given time, if the lobby is still empty, delete it
        @copy_current_request_context
        def lobby_cleanup(lobby_id):
            print("bef")
            sleep(5)
            print("after sleep")
            in_lobby = db.session.scalar(
                select(
                    func.count()
                ).select_from(
                    LobbyUser
                ).where(
                    LobbyUser.lobby_id == lobby_id,
                    LobbyUser.current_connection_id != None
                )
            )
            print("in lobby", in_lobby)
            if in_lobby == 0:
                print("deleting")
                lobby = db.session.get(Lobby, lobby_id)
                lobby.status = LobbyStatus.ENDED
                db.session.commit()
                socketio.emit(
                    "lobby_delete",
                    { "lobby_id": lobby_id }
                )

        eventlet.spawn(lobby_cleanup, lobby_id=conn.lobby_id)
        # socketio.start_background_task(target=lobby_cleanup)

    conn.disconnection_date = func.now()
    db.session.commit()

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)