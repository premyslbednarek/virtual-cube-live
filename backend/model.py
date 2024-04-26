from dataclasses import dataclass
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, select
from sqlalchemy.dialects.sqlite import DATETIME
from enum import Enum
from datetime import datetime, timedelta
from sqlalchemy import func
from typing import Optional, List, TypedDict
from cube import Cube

DEFAULT_INSPECTION_TIME=3

class LobbyUserStatus(Enum):
    NOT_READY = 0
    READY = 1
    SOLVING = 2
    SOLVED = 3

class UserRole(Enum):
    USER = 0
    ADMIN = 1

class LobbyRole(Enum):
    ADMIN = 0
    USER = 1

class LobbyStatus(Enum):
    WAITING = 0
    SOLVING = 1
    ENDED = 2

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    role: Mapped[UserRole] = mapped_column(default=UserRole.USER)
    created_date: Mapped[datetime] = mapped_column(insert_default=func.now())

# default datetime value example in:
# https://docs.sqlalchemy.org/en/20/orm/declarative_styles.html
class Lobby(db.Model):
    __tablename__ = "lobby"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    creator: Mapped[User] = relationship()
    created_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    status: Mapped[LobbyStatus] = mapped_column(default=LobbyStatus.WAITING)
    private: Mapped[bool] = mapped_column(default=False)
    cube_size: Mapped[int] = mapped_column(default=3)
    inspection_length: Mapped[int] = mapped_column(default=DEFAULT_INSPECTION_TIME)
    races_finished: Mapped[int] = mapped_column(default=0)
    wait_time: Mapped[int]

    def get_current_race(self) -> Optional["Race"]:
        return db.session.scalar(
            select(Race).where(Race.lobby_id == self.id, Race.ongoing)
        )

    def get_user(self, user_id: int) -> "LobbyUser":
        lobby_user = db.session.scalar(
            select(LobbyUser).where(LobbyUser.user_id==user_id, LobbyUser.lobby_id==self.id)
        )
        if lobby_user is None:
            raise ValueError("Lobby User does not exist")
        return lobby_user



class LobbyUser(db.Model):
    __tablename__ = "lobby_user"

    lobby_id: Mapped[int] = mapped_column(
        ForeignKey("lobby.id"),
        primary_key=True
    )
    lobby: Mapped[Lobby] = relationship()

    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id"),
        primary_key=True
    )
    user: Mapped[User] = relationship()

    current_connection_id: Mapped[Optional[int]] = mapped_column(ForeignKey("socket_connection.id"))
    current_connection: Mapped[Optional["SocketConnection"]] = relationship()
    status: Mapped[LobbyUserStatus] = mapped_column(default=LobbyUserStatus.NOT_READY)
    role: Mapped[LobbyRole] = mapped_column(default=LobbyRole.USER)
    points: Mapped[int] = mapped_column(default=0)

    @staticmethod
    def get(user_id: int, lobby_id: int) -> "LobbyUser":
        lobby_user = db.session.scalar(
            select(LobbyUser).where(LobbyUser.user_id==user_id, LobbyUser.lobby_id==lobby_id)
        )
        if lobby_user is None:
            raise ValueError("Lobby User does not exist")
        return lobby_user

class Scramble(db.Model):
    __tablename__ = "scramble"

    id: Mapped[int] = mapped_column(primary_key=True)
    cube_size: Mapped[int]
    scramble_string: Mapped[str]
    cube_state: Mapped[str]

class Solve(db.Model):
    __tablename__ = "solve"

    id: Mapped[int] = mapped_column(primary_key=True)
    scramble_id: Mapped[int] = mapped_column(ForeignKey("scramble.id"))
    scramble: Mapped[Scramble] = relationship()

    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped[User] = relationship()

    state: Mapped[str] = mapped_column(default="")

    time: Mapped[Optional[int]] = mapped_column(default=0)
    completed: Mapped[bool] = mapped_column(default=False)
    inspection_startdate: Mapped[datetime]
    solve_startdate: Mapped[datetime]
    reattempt: Mapped[bool] = mapped_column(default=False)

    race_id: Mapped[Optional[int]] = mapped_column(ForeignKey("race.id"))
    race: Mapped[Optional["Race"]] = relationship()

    solving_sessions: Mapped[List["SolvingSession"]] = relationship()

    def is_ongoing(self) -> bool:
        return self.solving_sessions[-1].end is None

    def add_move(self, move_str: str, timestamp: datetime) -> None:
        move = SolveMove(
            move=move_str,
            timestamp=timestamp,
            solving_session_id=self.solving_sessions[-1].id
        )
        db.session.add(move)
        db.session.commit()

    def add_camera_change(self, x, y, z, timestamp: datetime) -> None:
        camera_change = CameraChange(
            x=x,
            y=y,
            z=z,
            timestamp=timestamp,
            solving_session_id=self.solving_sessions[-1].id
        )
        db.session.add(camera_change)
        db.session.commit()

    class MoveType(TypedDict):
        move: str
        sinceStart: int

    def get_moves(self) -> List[MoveType]:
        moves = []
        total_time = 0
        for session in self.solving_sessions:
            for move in session.moves:
                moves.append({
                    # time before this session + time since this session start
                    "sinceStart": max(total_time + (move.timestamp - session.start) / timedelta(milliseconds=1), 0),
                    "move": move.move
                })
            if session.end:
                c = ((session.end - session.start) / timedelta(milliseconds=1))
                print(c, type(c))
                total_time += c

        for line in moves:
            print(line)
        return moves

    class CameraChangeType(TypedDict):
        x: float
        y: float
        z: float
        sinceStart: int

    def get_camera_changes(self) -> List[CameraChangeType]:
        camera_changes = []
        total_time = 0
        for session in self.solving_sessions:
            for camera_change in session.camera_changes:
                camera_changes.append({
                    "x": camera_change.x,
                    "y": camera_change.y,
                    "z": camera_change.z,
                    # sinceStart has to be bigger than zero - this can happen for inspection moves
                    "sinceStart": max(total_time + (camera_change.timestamp - session.start) / timedelta(milliseconds=1), 0)
                })
            if session.end:
                total_time += ((session.end - session.start) / timedelta(milliseconds=1))

        return camera_changes

    def start_session(self, timestamp: datetime):
        session = SolvingSession(
            solve_id=self.id,
            start=timestamp
        )
        db.session.add(session)
        db.session.commit()

    def end_current_session(self, timestamp: datetime):
        current_session = self.solving_sessions[-1]
        current_session.end = timestamp
        # convert time delta to ms
        # https://stackoverflow.com/a/74798645
        self.time += (current_session.end - current_session.start) / timedelta(milliseconds=1)
        db.session.commit()


class SolvingSession(db.Model):
    __tablename__ = "solving_session"

    id: Mapped[int] = mapped_column(primary_key=True)
    solve_id: Mapped[int] = mapped_column(ForeignKey("solve.id"))
    # solve: Mapped[int] = relationship()

    start: Mapped[datetime]
    end: Mapped[Optional[datetime]]

    moves: Mapped[List["SolveMove"]] = relationship()
    camera_changes: Mapped[List["CameraChange"]] = relationship()


class Race(db.Model):
    __tablename__ = "race"
    id: Mapped[int] = mapped_column(primary_key=True)

    scramble_id: Mapped[int] = mapped_column(ForeignKey("scramble.id"))
    scramble: Mapped[Scramble] = relationship()

    lobby_id: Mapped[int] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Lobby] = relationship()

    lobby_seq: Mapped[int]
    ongoing: Mapped[bool] = mapped_column(default=True)
    racers_count: Mapped[int]
    finishers_count: Mapped[int] = mapped_column(default=0)
    started_date: Mapped[datetime] = mapped_column(insert_default=func.now())

    solves: Mapped[List[Solve]] = relationship()

class SocketConnection(db.Model):
    __tablename__ = "socket_connection"
    id: Mapped[int] = mapped_column(primary_key=True)
    socket_id: Mapped[int]
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped[User] = relationship()

    connection_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    disconnection_date: Mapped[Optional[datetime]]

    cube_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cube.id"))
    cube: Mapped["CubeEntity"] = relationship()

    lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Lobby] = relationship()

    @staticmethod
    def get(sid: str) -> "SocketConnection":
        connection = db.session.scalar(
            select(SocketConnection).where(SocketConnection.socket_id == sid)
        )

        if not connection:
            raise ValueError("Connection with this sid does not exist")

        return connection


class CubeEntity(db.Model):
    __tablename__ = "cube"
    id: Mapped[int] = mapped_column(primary_key=True)
    size: Mapped[int]
    state: Mapped[str]
    current_solve_id: Mapped[Optional[int]] = mapped_column(ForeignKey("solve.id"))
    current_solve: Mapped[Optional[Solve]] = relationship()

    def make_move(self, move_str: str, timestamp: datetime):
        # get new cube state after the move
        cube = Cube(self.size, self.state)
        cube.move(move_str)
        new_state = cube.serialize()
        is_solved = cube.is_solved()

        cube.pprint()

        self.state = new_state

        # if there is a solve, add the move to the solve
        if self.current_solve:
            self.current_solve.add_move(move_str, timestamp)
            self.current_solve.state = new_state
            if (is_solved):
                self.current_solve.completed = True
                self.current_solve.end_current_session(timestamp)
                self.current_solve = None

        db.session.commit()

    def change_layers(self, new_size: int):
        if (self.current_solve):
            self.current_solve.end_current_session(datetime.now())

        self.size = new_size

        db.session.commit()

        self.set_default_state();

    def set_default_state(self):
        c = Cube(self.size)
        self.state = c.serialize()
        db.session.commit()

# i dont want to use insert_defaulf=func.now as it does not contain ms
class SolveMove(db.Model):
    __tablename__ = "solve_move"

    id: Mapped[int] = mapped_column(primary_key=True)

    timestamp: Mapped[datetime]
    solving_session_id: Mapped[int] = mapped_column(ForeignKey("solving_session.id"))
    # solving_session: Mapped[SolvingSession] = relationship()

    move: Mapped[str]

class CameraChange(db.Model):
    __tablename__ = "camera_change"

    id: Mapped[int] = mapped_column(primary_key=True)

    timestamp: Mapped[datetime]
    solving_session_id: Mapped[int] = mapped_column(ForeignKey("solving_session.id"))
    # solving_session: Mapped[SolvingSession] = relationship()

    x: Mapped[float]
    y: Mapped[float]
    z: Mapped[float]
