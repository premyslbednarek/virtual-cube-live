# https://stackoverflow.com/a/59155127
from init import app, socketio, login_manager, mail, db, logger
import eventlet
from flask import request, abort, copy_current_request_context
from flask_socketio import leave_room
from flask_login import login_user, current_user, login_required
from datetime import datetime
import json
from sqlalchemy import select, func
from model import User, Lobby, LobbyUser, Scramble, Solve, SocketConnection, CubeEntity, UserRole, LobbyStatus, Invitation
from cube import Cube
from typing import TypedDict, Optional, Dict
from eventlet import sleep
from functools import wraps

class RequestSolutionData(TypedDict):
    lobby_id: int

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)

# https://flask.palletsprojects.com/en/2.3.x/patterns/viewdecorators/
def admin_required(fun):
    @wraps(fun)
    def decorator(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != UserRole.ADMIN:
            return abort(401) # unauthorized
        return fun(*args, **kwargs)
    return decorator


def send_email(app, msg):
    with app.app_context():
        mail.send(msg)

@app.route('/api/update_banned_status', methods=["POST"])
@admin_required
def update_banned_status():
    data: Dict = json.loads(request.data)

    if not data:
        return abort(400)

    username: Optional[str] = data.get("username", None)
    status: Optional[bool] = data.get("status", None)

    if username is None or status is None:
        return abort(400)

    user = User.get(username)

    if not user:
        return abort(400)

    user.banned = status
    db.session.commit()

    return "ok", 200


@app.route('/api/update_solve_deleted_status', methods=["POST"])
@admin_required
def update_solve_deleted_status():
    data: Dict = json.loads(request.data)

    if not data:
        return abort(400)

    id: Optional[int] = data.get("id", None)
    status: Optional[bool] = data.get("status", None)

    if id is None or status is None:
        return abort(400)

    solve = db.session.get(Solve, id)

    if not solve:
        return abort(400)

    solve.deleted = status
    db.session.commit()

    return "ok", 200


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

    # check whether the user is in the given lobby
    if data["type"] == "lobby":
        if not LobbyUser.get(current_user.id, data["id"]):
            return abort(401) # unauthorized

    invitation = Invitation.create(current_user.username, data["id"], data["type"])

    return {"url": invitation.url}, 200

@app.route('/api/parse_invite/<string:uuid_str>')
@login_required
def handle_invite(uuid_str):
    invitation = Invitation.get_lobby(uuid_str)
    if invitation is None:
        return abort(404)

    if invitation["type"] == "lobby":
        lobbyuser = LobbyUser(
            lobby_id=invitation["id"],
            user_id=current_user.id,
        )
        db.session.add(lobbyuser)
        db.session.commit()

    return invitation


@app.route('/api/solves_to_continue')
def get_solves_to_continue():
    solves = db.session.execute(
        select(
            Solve.id,
            Solve.time,
            Solve.manually_saved,
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


def get_solves(username: Optional[str] = None, cube_size: Optional[int] = None):
    rows = db.session.execute(
            select(
            Solve.id.label("id"),
            Solve.completed.label("completed"),
            Solve.time.label("time"),
            Solve.race_id.label("race_id"),
            Scramble.cube_size.label("cube_size"),
            User.username.label("username"),
            User.banned.label("banned"),
            Solve.deleted.label("deleted"),
        ).join(
            Scramble, Solve.scramble_id == Scramble.id,
        ).outerjoin(
            User, Solve.user_id == User.id
        ).where(
            # if username is specified, filter by it
            not username or User.username == username,
            not cube_size or Scramble.cube_size == cube_size
        ).order_by(
            Solve.end_timestamp.desc()
        )
    )

    rows = [row._asdict() for row in rows.all()]
    for row in rows:
        if not row["username"]:
            solve = db.session.get(Solve, row["id"])
            creator = solve.lobby_together.creator.username
            row["username"] = f"{creator}' LobbyTogether"

    return rows


@app.route('/api/fetch_solves', methods=["GET", "POST"])
def fetch_solves():
    return get_solves(), 200


@app.route('/api/is_user', methods=["POST"])
def is_user():
    data = json.loads(request.data)
    username = data["username"]

    user = User.get(username)
    if not user:
        return abort(404)

    return "", 200

@app.route('/api/get_solves/<string:username>/<int:cube_size>')
def get_solves_(username: str, cube_size: int):
    return get_solves(username, cube_size), 200


@app.route('/api/current_user_info')
def get_current_user_info():
    if not current_user.is_authenticated:
        # create anonymous account for this user and log them
        login_user(User.create_anonymous(), remember=True)

    return {
        "username": current_user.username,
        "isLogged": not current_user.is_anonymous(),
        "isAdmin": current_user.role == UserRole.ADMIN
    }

@app.route('/api/user_info', methods=["POST"])
def get_user_info():
    data = json.loads(request.data)
    username = data["username"]
    if not username:
        return abort(400)

    user = db.session.scalars(
        select(User).where(User.username == username)
    ).one_or_none()

    if user is None:
        return abort(404)

    return {
        "username": user.username,
        "banned": user.banned,
        "role": "user" if user.role == UserRole.USER else "admin",
        "created_date": user.created_date,
        "solves": get_solves(user.username)
    }

@socketio.on("get_moves")
def get_solution():
    # return a list of moves that applying them to a cube will result in the current state
    # This includes the scrambles moves.
    connection = SocketConnection.get(request.sid)
    if connection is None:
        return {"status": "error"}

    if connection.user.role != UserRole.ADMIN:
        return {"status": "error"}

    solve = connection.cube.current_solve
    if solve is None:
        return {"status", "error"}

    # invalidate the solve
    solve.deleted = True
    db.session.commit()

    moves = list(map(lambda move: move["move"], solve.get_moves()))
    allmoves = solve.scramble.scramble_string.split() + moves
    return {"status": "ok", "moves": allmoves}



@app.route("/api/solve/<int:solve_id>")
def solve(solve_id: int):
    solve: Solve = db.session.get(Solve, solve_id)
    if solve is None:
        abort(404)

    return {
        "id": solve.id,
        "cube_size": solve.scramble.cube_size,
        "scramble": solve.scramble.scramble_string,
        "scramble_state": solve.scramble.cube_state.decode("UTF-8"),
        "moves": solve.get_moves(),
        "camera_changes": solve.get_camera_changes(),
        "completed": solve.completed,
        "time": solve.time,
        "banned": solve.user.banned if solve.user else False,
        "deleted": solve.deleted
    }

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

@socketio.event
def connect():
    pass


def together_lobby_dc(connection: SocketConnection):
    # handle socket disconnection from together lobby
    socket_room = connection.together_lobby.get_room()
    leave_room(socket_room)
    socketio.emit(
        "together_dc",
        { "username": connection.user.username },
        room=socket_room
    )
    users = connection.together_lobby.users
    for together_user in users:
        if together_user.user == current_user:
            users.remove(together_user)
            db.session.delete(together_user)
            db.session.commit()


def lobby_dc(connection: SocketConnection):
    # handle socket disconnection from together lobby
    lobby_user = LobbyUser.get(connection.user_id, connection.lobby_id)
    lobby_user.current_connection_id = None
    db.session.commit()

    leave_room(connection.lobby_id)

    socketio.emit(
        "lobby_disconnection",
        { "username": current_user.username },
        room=connection.lobby_id
    )

    # run a function after 5 seconds - if the lobby is still empty after that
    # time, delete the lobby
    # this function is defined here, because we copy the current request context
    @copy_current_request_context
    def lobby_cleanup(lobby_id):
        sleep(5)
        user_count = db.session.scalar(
            select(
                func.count()
            ).select_from(
                LobbyUser
            ).where(
                LobbyUser.lobby_id == lobby_id,
                LobbyUser.current_connection_id != None
            )
        )

        if user_count == 0:
            logger.info("deleting lobby", lobby_id)
            lobby = db.session.get(Lobby, lobby_id)
            lobby.status = LobbyStatus.ENDED
            db.session.commit()
            socketio.emit(
                "lobby_delete",
                { "lobby_id": lobby_id }
            )

    eventlet.spawn(lobby_cleanup, lobby_id=connection.lobby_id)


@socketio.event
def disconnect():
    now = datetime.now()
    connection = SocketConnection.get(request.sid)
    if not connection:
        return

    connection.disconnection_date = now
    db.session.commit()

    socketio.emit(
        "lobby_disconnection",
        { "username": current_user.username },
        room=connection.lobby_id
    )

    # end current solve if the user is not in together lobby
    if connection.cube and connection.cube.current_solve and not connection.together_lobby:
        connection.cube.current_solve.end_current_session(now)

    if connection.together_lobby:
        together_lobby_dc(connection)

    if connection.lobby:
        lobby_dc(connection)
