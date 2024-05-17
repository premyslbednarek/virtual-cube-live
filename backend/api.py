# https://stackoverflow.com/a/59155127
from init import app, socketio, login_manager, mail, db
import eventlet
from flask import request, render_template, flash, abort, copy_current_request_context
from flask_socketio import join_room, leave_room, rooms
from flask_login import login_user, logout_user, current_user, login_required
from flask_mail import Message
from threading import Thread
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import json
from sqlalchemy import select, func
from model import User, Lobby, LobbyUser, Scramble, Solve, Race, SocketConnection, CubeEntity, DEFAULT_INSPECTION_TIME, LobbyUserStatus, UserRole, LobbyRole, LobbyStatus, Invitation, ANONYMOUS_PREFIX
from cube import Cube
from typing import TypedDict, Optional, Dict, List
from eventlet import sleep
from functools import wraps
import logging

logger = logging.getLogger(__name__)

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

from threading import Thread

def send_email(app, msg):
    with app.app_context():
        mail.send(msg)

@app.route('/api/new_password_reset', methods=["POST"])
@login_required
def send_password_reset():
    data = json.loads(request.data)
    if not data:
        abort(400)

    username = data["username"]
    email = data["email"]
    baseURL = data["baseURL"]

    user: Optional[User] = User.get(username)

    if not user or not user.email_hash:
        return {"msg": "Wrong username or email", "status": 400}

    if not check_password_hash(user.email_hash, email):
        return {"msg": "The email does not match", "status": 400}

    token = user.create_password_token()
    msg = Message()
    msg.subject = "Virtual Cube password reset"
    msg.sender = app.config["MAIL_USERNAME"]
    msg.recipients = [email]
    msg.html = render_template("email.html", url=f"{baseURL}/password_reset/{token}")
    Thread(target=send_email, args=(app, msg)).start()
    return {"msg": "ok", "status": 200}


@app.route('/api/reset_password', methods=["POST"])
@login_required
def reset_password():
    data = json.loads(request.data)
    if not data:
        abort(400)

    password = data["password"]
    confirmPassword = data["confirmPassword"]
    token = data["token"]

    if password != confirmPassword:
        return {"msg": "Password do not match", "status": 400}

    if len(password) < 6:
        return {"msg": "The password must be at least 6 characters", "status": 400}


    ret: User | str = User.get_user_from_token(token)
    if isinstance(ret, str):
        return {"msg": ret, "status": 400}

    ret.password_hash = generate_password_hash(password)
    db.session.commit()
    return {"msg": "Your password has been reset", "status": 200}


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


@app.route("/api/get_lobbies")
def get_lobbies():
    res = db.session.execute(
        select(
            User.username.label("creator"),
            Lobby.id.label("id"),
            Lobby.cube_size.label("cubeSize")
        ).select_from(
            Lobby
        ).where(
            Lobby.private == False,
            Lobby.status != LobbyStatus.ENDED
        ).join(
            User, Lobby.creator_id == User.id
        ).order_by(Lobby.id.desc()).limit(20)

    ).all()

    return [lobby._asdict() for lobby in res]

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
            {"creator": current_user.username, "id": lobby.id, "cubeSize": data["layers"] }
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

@app.route('/api/register', methods=["POST"])
def register_post():
    data = json.loads(request.data)
    username: str = data['username']
    password: str = data['password']
    confirmPassword: str = data['confirmPassword']
    keep_data: bool = data['keepData']
    email: str = data["email"]

    if not username or not password or not confirmPassword:
        return {"msg": "Fill in all form fields"}, 400

    if password != confirmPassword:
        return {"msg": "Passwords do not match"}, 400

    if len(password) < 6:
        return {"msg": "Password should be at least 6 characters long"}, 400

    if username.startswith(ANONYMOUS_PREFIX):
        return {"msg", "Username cannot start with Anonymous#"}, 400

    # check whether user with given username already exists
    user = db.session.execute(
        select(User).where(func.lower(User.username) == func.lower(username))
    ).first()

    if user is not None:
        return {"msg": "User with entered username already exists"}, 400

    password_hash: str = generate_password_hash(password)
    email_hash = generate_password_hash(email)

    if keep_data:
        current_user.username = username
        current_user.password_hash = password_hash,
        current_user.email_hash=email_hash
    else:
        user = User(
            username=username,
            password_hash=password_hash,
            email_hash=email_hash
        )
        db.session.add(user)

    db.session.commit()

    return {"msg": "ok"}, 200

@app.route('/api/login', methods=["POST"])
def login_post():
    data = json.loads(request.data)
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

    if user.banned:
        return {"msg", "Your account has been banned."}

    login_user(user, remember=True)
    logger.info(user.username, "logged in")
    return {"msg": "ok" }

@app.route("/api/logout")
@login_required
def logout():
    logger.info(current_user.username, "logged out")
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
def handle_solo_join():
    create_connection(3)

def join_lobby(lobby: Lobby, lobby_user: Optional[LobbyUser], is_creator: bool):
    # add user to the lobby room
    join_room(lobby.id)

    # add connection to the database
    if not lobby_user:
        lobby_user = LobbyUser(
            lobby_id=lobby.id,
            user_id=current_user.id,
            role=LobbyRole.ADMIN if is_creator else LobbyRole.USER
        )
        db.session.add(lobby_user)
        db.session.commit()

    lobby_user.current_connection_id=create_connection(lobby.cube_size, None, lobby.id)
    db.session.commit()

    # inform other users in the lobby about this the connection
    socketio.emit(
        "lobby_connection",
        {
            "username": current_user.username,
            "points": lobby_user.points,
            "isAdmin": lobby_user.role == LobbyRole.ADMIN
        },
        room=lobby.id,
        skip_sid=request.sid
    )

def get_lobby_data(lobby: Lobby, is_creator: bool):
    # fetch info about other users in the lobby of users in the room
    users = db.session.scalars(
        select(LobbyUser).where(LobbyUser.lobby_id == lobby.id,
                                LobbyUser.user_id != current_user.id)
    ).all()

    userlist = [(
            lobbyuser.user.username,
            lobbyuser.status == LobbyUserStatus.READY,
            lobbyuser.role == LobbyRole.ADMIN,
            lobbyuser.current_connection.cube.state.decode("UTF-8")
        ) for lobbyuser in users
    ]

    raceTime = None
    current_race = lobby.get_current_race()
    if current_race:
        raceTime = (datetime.now() - current_race.started_date) / timedelta(milliseconds=1)

    return {
        "status": 200,
        "userList": userlist,
        "isAdmin": is_creator,
        "cubeSize": lobby.cube_size,
        "points": lobby.get_user_points(),
        "raceTime": raceTime
    }


@socketio.on("lobby_connect")
def handle_lobby_conection(data):
    # this is handled through a socket message instead to synchronize
    # with other events in this lobby. Otherwise, all socket messages between
    # the request and socket connection would be lost
    lobby_id: int = int(data["lobby_id"])

    logger.info("new connection to lobby:", lobby_id, "user_id", current_user.username)

    lobby: Lobby = db.session.get(Lobby, lobby_id)
    is_creator: bool = lobby.creator_id == current_user.id

    # check whether the user has already joined the lobby before
    lobby_user = LobbyUser.get(current_user.id, lobby_id)
    if lobby_user and lobby_user.current_connection_id:
        return {"status": 400, "msg": "You have already joined this lobby"}

    if lobby_user and lobby_user.status == LobbyUserStatus.KICKED:
        return {"status": 400, "msg": "You have been kicked from this lobby"}

    # lobby creator can always join
    # otherwise, if the lobby is private, other users can only join
    # if the their LobbyUser object is already present (it is create through
    # /api/invite/<invitation_uuid>
    if not is_creator and not lobby_user and lobby.private:
        return {"status": 400, "msg": "This lobby is private. You can join only via an invitation"}

    join_lobby(lobby, lobby_user, is_creator)
    return get_lobby_data(lobby, is_creator)


@socketio.on("lobby_make_admin")
@login_required
def make_admin(data):
    connection = SocketConnection.get(request.sid)
    lobby_user = LobbyUser.get(current_user.id, connection.lobby_id)
    if not lobby_user or lobby_user.role != LobbyRole.ADMIN:
        return

    user = db.session.scalars(
        select(User).where(User.username == data["username"])
    ).first()

    if not user:
        return

    lobby_user = LobbyUser.get(user.id, connection.lobby_id)
    lobby_user.role = LobbyRole.ADMIN
    db.session.commit()

    socketio.emit(
        "lobby_new_admin",
        {"username": data["username"]},
        room=connection.lobby_id
    )


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

    logger.info(current_user.username, "changed their lobby status to", ready_status)


@socketio.on("lobby_kick")
@login_required
def lobby_kick(data):
    connection = SocketConnection.get(request.sid)
    lobby_user = LobbyUser.get(current_user.id, connection.lobby_id)
    if not lobby_user or lobby_user.role != LobbyRole.ADMIN:
        return

    user = db.session.scalars(
        select(User).where(User.username == data["username"])
    ).first()

    if not user:
        return

    lobby_user = LobbyUser.get(user.id, connection.lobby_id)

    if lobby_user.role == LobbyRole.ADMIN:
        return

    lobby_user.status = LobbyUserStatus.KICKED
    db.session.commit()

    socketio.emit(
        "lobby_kick",
        {"username": data["username"]},
        room=connection.lobby_id
    )


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

    connection.cube.current_solve = None
    solve.end_current_session(datetime.now())
    solve.manually_saved = True
    db.session.commit()


@socketio.on("solo_solve_start")
def solo_solve_start():
    connection = db.session.scalar(
        select(SocketConnection).where(SocketConnection.socket_id == request.sid)
    )
    if connection is None:
        return

    scramble: Scramble = Scramble.new(connection.cube.size)

    now = datetime.now()

    solve = Solve(
        scramble_id=scramble.id,
        user_id = current_user.id,
        inspection_startdate=now,
        solve_startdate=now + timedelta(seconds=DEFAULT_INSPECTION_TIME),
        state=scramble.cube_state
    )

    db.session.add(solve)
    db.session.commit()

    solve.start_session(now + timedelta(seconds=DEFAULT_INSPECTION_TIME))

    connection.cube.current_solve_id = solve.id
    connection.cube.state = scramble.cube_state

    db.session.commit()

    return {
        "state": scramble.cube_state.decode("UTF-8")
    }


def lobby_start_race(lobby: Lobby, users: List[LobbyUser], racers_count: int):
    scramble: Scramble = Scramble.new(lobby.cube_size)

    now = datetime.now()
    solve_startdate: datetime = now + timedelta(seconds=DEFAULT_INSPECTION_TIME)

    race = Race(
        scramble_id=scramble.id,
        lobby_id=lobby.id,
        lobby_seq=lobby.races_finished,
        racers_count=racers_count,
        started_date=solve_startdate
    )

    db.session.add(race)
    db.session.flush()

    for lobby_user in users:
        if (lobby_user.current_connection is None):
            continue


        solve = Solve(
            scramble_id=scramble.id,
            user_id = lobby_user.user_id,
            race_id=race.id,
            inspection_startdate=now,
            solve_startdate=solve_startdate
        )

        db.session.add(solve)
        db.session.commit()

        solve.start_session(now + timedelta(seconds=DEFAULT_INSPECTION_TIME))

        lobby_user.current_connection.cube.current_solve_id = solve.id
        lobby_user.current_connection.cube.state = scramble.cube_state

        lobby_user.status = LobbyUserStatus.SOLVING

    db.session.commit()

    socketio.emit(
        "match_start",
        {
            "state": scramble.cube_state.decode("UTF-8"),
            "startTime": solve_startdate.isoformat()
        },
        room=lobby.id
    )


@socketio.on("lobby_start")
def lobby_start_request(data):
    lobby_id = int(data["lobby_id"])
    force = bool(data["force"])

    lobby: Lobby = db.session.get(Lobby, lobby_id)

    # check whether the user is the lobby creator or admin of the lobby
    lobby_user = LobbyUser.get(current_user.id, lobby_id)

    if (lobby_user.role != LobbyRole.ADMIN and lobby.creator_id != current_user.id):
        logger.info("Somebody else than the room admin and creator tried to start the match")
        return

    # check whether all connected users are ready
    q = select(LobbyUser).where(LobbyUser.lobby_id == lobby_id)
    users: List[LobbyUser] = db.session.scalars(q).all()

    racers_count = 0

    for lobby_user in users:
        if lobby_user.current_connection is not None:
            racers_count += 1
            if not force and lobby_user.status != LobbyUserStatus.READY:
                logger.info(lobby_user.user_id, "is not ready")
                return

    # everybody is ready, start the race
    lobby_start_race(lobby, users, racers_count)


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
