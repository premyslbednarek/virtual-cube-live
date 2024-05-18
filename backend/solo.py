from api import create_connection
from init import db, socketio
from model import DEFAULT_INSPECTION_TIME, Scramble, SocketConnection, Solve

from flask import request
from flask_login import current_user
from sqlalchemy import select

from datetime import datetime, timedelta


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


@socketio.on("solo_join")
def handle_solo_join():
    create_connection(3)


@socketio.on("change_layers")
def change_layers(data):
    connection = SocketConnection.get(request.sid)
    connection.cube.change_layers(data["newSize"])


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