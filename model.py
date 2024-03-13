from dataclasses import dataclass
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey
from enum import Enum
from datetime import datetime
from sqlalchemy import func
from typing import Optional

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

    connected: Mapped[bool] = mapped_column(default=True)
    status: Mapped[LobbyUserStatus] = mapped_column(default=LobbyUserStatus.NOT_READY)
    role: Mapped[LobbyRole] = mapped_column(default=LobbyRole.USER)
    points: Mapped[int] = mapped_column(default=0)

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

    time: Mapped[int]
    moves: Mapped[str]
    completed: Mapped[bool]
    start_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    reattempt: Mapped[bool]

    race_id: Mapped[Optional[int]] = mapped_column(ForeignKey("race.id"))
    race: Mapped[Optional["Race"]] = relationship()

class Race(db.Model):
    __tablename__ = "race"
    id: Mapped[int] = mapped_column(primary_key=True)

    scramble_id: Mapped[int] = mapped_column(ForeignKey("scramble.id"))
    scramble: Mapped[Scramble] = relationship()

    lobby_id: Mapped[int] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Lobby] = relationship()

    lobby_seq: Mapped[int]
    ongoing: Mapped[bool]
    racers_count: Mapped[int]
    finishers_count: Mapped[int]
    started_date: Mapped[datetime] = mapped_column(insert_default=func.now())

class SocketConnection(db.Model):
    __tablename__ = "socket_connection"
    id: Mapped[int] = mapped_column(primary_key=True)
    socket_id: Mapped[int]
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped[User] = relationship()

    connection_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    disconnection_date: Mapped[Optional[datetime]]

    cube_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cube.id"))
    cube: Mapped["Cube"] = relationship()

    lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Lobby] = relationship()

class Cube(db.Model):
    __tablename__ = "cube"
    id: Mapped[int] = mapped_column(primary_key=True)
    size: Mapped[int]
    state: Mapped[str]
    current_solve_id: Mapped[Optional[int]] = mapped_column(ForeignKey("solve.id"))
    current_solve: Mapped[Optional[Solve]] = relationship()