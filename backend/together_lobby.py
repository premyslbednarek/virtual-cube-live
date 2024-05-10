from app import app, socketio
from flask_login import login_required, current_user
from model import db, SocketConnection, TogetherLobby, CubeEntity, Solve, TogetherUser, Scramble, DEFAULT_INSPECTION_TIME
from flask import request, abort
from datetime import datetime
from typing import TypedDict
from flask_socketio import join_room
import json
from uuid import UUID
from sqlalchemy import select
from datetime import timedelta


@app.route("/together/new")
@login_required
def new_together_lobby():
    cube = CubeEntity(size=3)
    cube.set_default_state()

    together_lobby = TogetherLobby(
        cube=cube
    )

    together_lobby.creator = current_user

    db.session.add(cube)
    db.session.add(together_lobby)
    db.session.commit()

    return { "id": together_lobby.id }, 200


class TogetherJoinData(TypedDict):
    id: int

@socketio.on("together_join")
@login_required
def together_user_join(data: TogetherJoinData):
    together_lobby = db.session.get(TogetherLobby, data["id"])

    connection = SocketConnection()
    connection.user = current_user
    connection.socket_id = request.sid
    connection.cube = together_lobby.cube
    connection.together_lobby = together_lobby

    together_user = TogetherUser()
    together_user.user = current_user
    together_lobby.users.append(together_user)

    db.session.add(connection)
    db.session.add(together_user)
    db.session.commit()

    socketio.emit(
        "together_join",
        { "username": current_user.username },
        room=together_lobby.get_room()
    )

    join_room(together_lobby.get_room())

    return {
        "users": [together_user.user.username for together_user in together_lobby.users],
        "cube_size": together_lobby.cube.size,
        "cube_state": together_lobby.cube.state.decode("UTF-8"),
        "solveTime": together_lobby.cube.current_solve.get_ongoing_time() if together_lobby.cube.current_solve else None
    }


def get_together_lobby() -> TogetherLobby | None:
    connection = SocketConnection.get(request.sid)
    if not connection:
        return None

    together_lobby = connection.together_lobby
    if not together_lobby:
        return None

    return together_lobby


@app.route("/api/get_together_id", methods=["POST"])
@login_required
def get_together_id():
    data = json.loads(request.data)
    together_lobby = db.session.scalar(
        select(TogetherLobby).where(TogetherLobby.uuid == UUID(data["uuid"]))
    )
    if not together_lobby:
        return abort(400)

    return { "id": together_lobby.id }, 200

@socketio.on("together_reset")
@login_required
def together_reset():
    connection = SocketConnection.get(request.sid)
    if not connection:
        return abort(400)

    together_lobby = connection.together_lobby
    if not together_lobby:
        return abort(400)

    together_lobby.cube.set_default_state()
    socketio.emit(
        "together_set_state",
        { "state": together_lobby.cube.state.decode("UTF-8")},
        room=together_lobby.get_room()
    )

@socketio.on("together_solve_start")
@login_required
def together_lobby_start():
    together_lobby = get_together_lobby()
    if not together_lobby:
        return

    cube = together_lobby.cube

    scramble = Scramble.new(cube.size)

    inspection_start = datetime.now()
    solve_start = inspection_start + timedelta(seconds=DEFAULT_INSPECTION_TIME)

    solve = Solve()
    solve.scramble = scramble
    solve.inspection_startdate = inspection_start
    solve.solve_startdate = solve_start
    solve.state = scramble.cube_state
    solve.lobby_together=together_lobby

    cube.current_solve = solve
    cube.state = scramble.cube_state

    db.session.add(solve)
    db.session.commit() # obtain solve id for session start

    solve.start_session(solve_start)

    socketio.emit(
        "together_solve_start",
        {
            "state": scramble.cube_state.decode("UTF-8"),
        },
        room=together_lobby.get_room()
    )

@socketio.on("together_layers_change")
@login_required
def together_layers_change(data):
    new_size = data["newSize"]
    together_lobby = get_together_lobby()
    if not together_lobby:
        return

    together_lobby.cube.change_layers(new_size)

    socketio.emit(
        "together_layers_change",
        data,
        room=together_lobby.get_room()
    )