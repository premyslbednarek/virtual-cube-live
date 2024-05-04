from app import socketio
from flask import copy_current_request_context
from flask_login import login_required, current_user
from model import db, SocketConnection, TogetherLobby, Lobby, CubeEntity, Solve, LobbyUserStatus, Race
from flask import request
from datetime import datetime
import time


def handle_solve_completed(solve: Solve, lobby: Lobby):
    socketio.emit(
        "solve_completed",
        {
            "username": current_user.username,
            "time": solve.time
        },
        room=lobby.id,
        skip_sid=request.sid
    )

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
            { "time": lobby.wait_time },
            room=lobby.id
        )

        socketio.start_background_task(
            target=end_race_if_not_ended,
            race_id=current_race.id,
            delay=lobby.wait_time
        )

    current_race.end_race_if_finished()

    db.session.commit()


@socketio.on("move")
@login_required
def handle_move(data):
    now = datetime.now()
    move_str: str = data["move"]

    connection = SocketConnection.get(request.sid)
    if connection is None:
        return

    solve = connection.cube.current_solve

    if solve and solve.completed:
        print("Move in a done solve, ignoring")
        return

    if solve and now <= solve.solve_startdate and move_str not in ["x", "x'", "y", "y'", "z", "z'"]:
        print("move during inspection, ignoring")
        return

    connection.cube.make_move(move_str, now)

    if solve and solve.completed:
        socketio.emit(
            "your_solve_completed",
            { "time": solve.time, "solve_id": solve.id },
            to=request.sid
        )

    if connection.together_lobby:
        socketio.emit(
            "together_move",
            { "move": move_str, "username": current_user.username},
            room=connection.together_lobby.get_room()
        )

        if solve and solve.completed:
            socketio.emit(
                "together_solve_end",
                { "time": solve.time },
                room=connection.together_lobby.get_room()
            )

    elif connection.lobby:
        socketio.emit(
            "lobby_move",
            {
                "username": current_user.username,
                "move": move_str
            },
            room=connection.lobby_id,
            skip_sid=request.sid
        )

        if solve and solve.completed:
            handle_solve_completed(solve, connection.lobby)

@socketio.on("camera")
def handle_camera(data):
    position = data["position"]
    connection = SocketConnection.get(request.sid)
    if not connection:
        return

    cube_entity: CubeEntity = connection.cube

    solve: Solve = cube_entity.current_solve
    if solve:
        solve.add_camera_change(position)

    together_lobby = connection.together_lobby
    if together_lobby:
        socketio.emit(
            "together_camera",
            { "position": position, "username": current_user.username},
            room=together_lobby.get_room()
        )

    lobby = connection.lobby
    if lobby:
        socketio.emit(
            "lobby_camera",
            { "username": current_user.username, "position": position },
            room=lobby.id,
            skip_sid=request.sid
        )