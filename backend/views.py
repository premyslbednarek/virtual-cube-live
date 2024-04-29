# https://stackoverflow.com/a/59155127
from app import app, socketio, login_manager, PRODUCTION, mode

import eventlet
import time
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
from functools import wraps
from uuid import uuid4

class RequestSolutionData(TypedDict):
    lobby_id: int

# https://flask.palletsprojects.com/en/2.3.x/patterns/viewdecorators/
def admin_required(fun):
    @wraps(fun)
    def decorator(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != UserRole.ADMIN:
            return abort(401) # unauthorized
        return fun(*args, **kwargs)
    return decorator

@app.route('/api/<string:username>/make_admin')
@admin_required
def make_admin(username: str):
    user = db.session.scalars(
        select(User).where(User.username == username)
    ).one_or_none()

    if user:
        user.role = UserRole.ADMIN
        db.session.commit()
        return "success", 200

    return "error", 400

@app.route('/api/generate_invitation', methods=["POST"])
@login_required
def generate_invitation():
    data = json.loads(request.data)
    lobby_id: int = data["lobbyId"]

    # check whether the user is in the given lobby
    lobbyuser = LobbyUser.get(current_user.id, lobby_id)
    if not lobbyuser:
        return abort(401) # unauthorized

    invitation_url = uuid4()
    return {"url": invitation_url}, 200




@app.route('/api/solves_to_continue')
def get_solves_to_continue():
    solves = db.session.execute(
        select(
            Solve.id,
            Solve.time,
            Scramble.cube_size
        ).select_from(
            Solve
        ).join(
            Scramble, Solve.scramble_id == Scramble.id
        ).where(
            Solve.user_id == current_user.id,
            Solve.completed == False
        )
    ).all()
    return {"solves": [solve._asdict() for solve in solves]}

@app.route('/api/get_solves/<string:username>/<int:cube_size>')
def get_solves(username: str, cube_size: int):
    solves = db.session.execute(
        select(
            Solve.id,
            Solve.time,
            Solve.completed
        ).join(
            Scramble, Solve.scramble_id == Scramble.id,
        ).join(
            User, Solve.user_id == User.id
        ).where(
            User.username == username,
            Scramble.cube_size == cube_size
        ).order_by(
            Solve.id.desc()
        )
    ).all()
    return [solve._asdict() for solve in solves]


@socketio.on("continue_solve")
def continue_solve(data):
    connection = SocketConnection.get(request.sid)
    solve = db.session.get(Solve, data["solve_id"])
    new_size = solve.scramble.cube_size

    connection.cube.change_layers(new_size)

    solve.start_session(datetime.now())
    connection.cube.current_solve = solve
    connection.cube.state = solve.state

    db.session.commit()

    return {
        "startTime": solve.time,
        "state": solve.state.decode("UTF-8"),
        "layers": solve.scramble.cube_size
    }

@socketio.on("change_layers")
def change_layers(data):
    connection = SocketConnection.get(request.sid)
    connection.cube.change_layers(data["newSize"])

@app.route('/api/user/<string:username>')
def get_user(username: str):
    user = db.session.scalars(
        select(User).where(User.username == username)
    ).one_or_none()

    if user is None:
        return abort(404)

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
            Solve.user_id == user.id
        )
    ).all()
    print(solves, type(solves))

    return {
        "username": user.username,
        "role": "user" if user.role == UserRole.USER else "admin",
        "created_date": user.created_date,
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
    confirmPassword: str = data['confirmPassword']

    if not username or not password or not confirmPassword:
        return {"msg": "Fill in all form fields"}, 400

    if password != confirmPassword:
        return {"msg": "Passwords do not match"}, 400

    if len(password) < 6:
        return {"msg": "Password should be at least 6 characters long"}, 400

    # check whether user with given username already exists
    user = db.session.execute(
        select(User).where(func.lower(User.username) == func.lower(username))
    ).first()

    if user is not None:
        return {"msg": "User with entered username already exists"}, 400

    # add new user to the database
    password_hash: str = generate_password_hash(password)
    new_user = User(username=username, password_hash=password_hash)
    db.session.add(new_user)
    db.session.commit()

    login_user(new_user, remember=True)
    return {"msg": "ok"}, 200

@app.route('/login', methods=["POST"])
def login_post():
    data = json.loads(request.data)
    print(data)
    username: str = data['username']
    password: str = data['password']

    if not username or not password:
        return {"msg": "Fill in all form fields"}, 400

    user = db.session.scalars(
        select(User).where(User.username == username)
    ).one_or_none()

    # check whether user with given username exists and the password matches
    if user is None or not check_password_hash(user.password_hash, password):
        flash("Wrong username or password!")
        return {"msg": "Wrong username or password"}, 400

    login_user(user, remember=True)
    print("Login succesfull")
    return {"msg": "ok" }

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
        "points": lobby.get_user_points()
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

@socketio.on("save_solve")
def save_solve():
    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )
    if connection is None:
        return

    solve = connection.cube.current_solve
    if not solve:
        return

    solve.end_current_session(datetime.now())


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
        solve_startdate=now + timedelta(seconds=INSPECTION_LENGTH_SECONDS),
        state=scramble.cube_state
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

@socketio.on("lobby_move")
def lobby_move(data):
    now = datetime.now()
    move: str = data["move"]

    connection = SocketConnection.get(request.sid)
    lobby = connection.lobby

    # print(current_user.username, "in lobby", lobby.id, "has made a ", move, "move")

    if lobby:
        socketio.emit(
            "lobby_move",
            {
                "username": current_user.username,
                "move": move
            },
            room=lobby.id,
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

    # if the solve was finished with this move, notify the users about it
    # and distribute the server solve time to them
    if solve and solve.completed:
        socketio.emit(
            "your_solve_completed",
            {
                "time": solve.time,
                "solve_id": solve.id
            },
            to=request.sid
        )

        if lobby:
            socketio.emit(
                "solve_completed",
                {
                    "username": current_user.username,
                    "time": solve.time
                },
                room=lobby.id,
                skip_sid=request.sid
            )


    if lobby and solve and solve.completed:
        lobby_user = lobby.get_user(current_user.id)
        lobby_user.status = LobbyUserStatus.SOLVED
        current_race = lobby.get_current_race()
        current_race.finishers_count = current_race.finishers_count + 1

        @copy_current_request_context
        def end_race_if_not_ended(race_id: int, delay: int):
            time.sleep(delay)
            # passing race directly is not possible due to sqlalchemy object
            # expiration
            race = db.session.get(Race, race_id)
            if race.ongoing:
                race.end()

        # it the user was the first to finish in the lobby, start
        # solve end countdown (all users have to finish within the time limit,
        # or they get DNF)
        if current_race.finishers_count == 1:
            socketio.emit(
                "solve_end_countdown",
                { "waitTime": lobby.wait_time },
                room=lobby.id
            )

            socketio.start_background_task(
                target=end_race_if_not_ended,
                race_id=current_race.id,
                delay=lobby.wait_time
            )

        current_race.end_race_if_finished()

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

    connection = SocketConnection.get(request.sid)
    if (connection.cube.current_solve):
        connection.cube.current_solve.end_current_session(datetime.now())

    if connection.lobby_id is not None:
        print("Lobby disconnection", connection.lobby_id, current_user.username)
        q = select(LobbyUser).where(LobbyUser.user_id == connection.user_id, LobbyUser.lobby_id == connection.lobby_id)
        lobby_user: LobbyUser = db.session.scalar(q)
        lobby_user.current_connection_id = None
        db.session.commit()

        leave_room(connection.lobby_id)

        socketio.emit(
            "lobby_disconnection",
            { "username": current_user.username },
            room=connection.lobby_id
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

        eventlet.spawn(lobby_cleanup, lobby_id=connection.lobby_id)
        # socketio.start_background_task(target=lobby_cleanup)

    connection.disconnection_date = func.now()
    db.session.commit()