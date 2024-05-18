from datetime import datetime, timedelta

from flask import request
from flask_socketio import join_room
from api import create_connection
from init import app, db, socketio, logger
from model import DEFAULT_INSPECTION_TIME, Lobby, LobbyRole, LobbyStatus, LobbyUser, LobbyUserStatus, Race, Scramble, SocketConnection, Solve, User
import json

from flask_login import current_user, login_required
from sqlalchemy import select

from typing import List, TypedDict, Optional


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


class LobbyCreateResponse(TypedDict):
    lobby_id: int


class LobbyCreateData(TypedDict):
    layers: int
    private: bool
    waitTime: int


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


@socketio.on("lobby_make_admin")
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