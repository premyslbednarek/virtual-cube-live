from init import socketio, db
from cube import generate_scramble
from uuid import uuid4, UUID
import os
from flask_login import UserMixin
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, select, update
from enum import Enum
from datetime import datetime, timedelta
from sqlalchemy import func
from typing import Optional, List, TypedDict, Union
from cube import Cube
from werkzeug.security import generate_password_hash
import jwt


DEFAULT_INSPECTION_TIME=3

class LobbyUserStatus(Enum):
    NOT_READY = 0
    READY = 1
    SOLVING = 2
    SOLVED = 3
    KICKED = 4

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


ANONYMOUS_PREFIX = "Anonymous"

class User(UserMixin, db.Model):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    email_hash: Mapped[Optional[str]] = mapped_column(default=None)
    password_hash: Mapped[str] = mapped_column(default="")
    role: Mapped[UserRole] = mapped_column(default=UserRole.USER)
    created_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    banned: Mapped[bool] = mapped_column(default=False)

    def create_password_token(self):
        return jwt.encode(
            {
                "username": self.username,
                "expires": (datetime.now() + timedelta(seconds=600)).isoformat()
            }, key=os.getenv("JWT_SECRET"), algorithm='HS256')

    @staticmethod
    def get_user_from_token(token: str) -> Union["User", str]:
        try:
            decoded = jwt.decode(token, key=os.getenv("JWT_SECRET"), algorithms=['HS256'])
            if datetime.now() > datetime.fromisoformat(decoded["expires"]):
                return "The token has expired"
            username = decoded["username"]
            user = User.get(username)
            if not user:
                return "Invalid token"
        except Exception as e:
            print(e)
            return "Invalid token"
        return user

    @staticmethod
    def create_anonymous():
        user = User()
        user.username = ANONYMOUS_PREFIX
        db.session.add(user)
        db.session.flush() # obtain user id
        user.username = user.username + f"{user.id:04d}"
        db.session.commit()
        return user

    def is_anonymous(self):
        return self.username.startswith(ANONYMOUS_PREFIX)

    def get(handle: int | str) -> Optional["User"]:
        if isinstance(handle, int):
            return db.session.get(User, handle)
        else:
            return db.session.scalar(
                select(User).where(User.username == handle)
            )

class LobbyPoints(TypedDict):
    username: str
    points: int

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

    def get_user(self, user_id: int) -> Optional["LobbyUser"]:
        lobby_user = db.session.scalar(
            select(LobbyUser).where(LobbyUser.user_id==user_id, LobbyUser.lobby_id==self.id)
        )
        return lobby_user

    def get_user_points(self) -> List[LobbyPoints]:
        res = db.session.execute(
            select(User.username, LobbyUser.points)
                .select_from(LobbyUser)
                .join(User, User.id == LobbyUser.user_id)
                .where(LobbyUser.lobby_id == self.id)
                .order_by(LobbyUser.points.desc())
        )
        return [{"username": username, "points": points} for username, points in res]




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
    def get(user_id: int, lobby_id: int) -> Optional["LobbyUser"]:
        lobby_user = db.session.scalar(
            select(LobbyUser).where(LobbyUser.user_id==user_id, LobbyUser.lobby_id==lobby_id)
        )
        return lobby_user


class Scramble(db.Model):
    __tablename__ = "scramble"

    id: Mapped[int] = mapped_column(primary_key=True)
    cube_size: Mapped[int]
    scramble_string: Mapped[str]
    cube_state: Mapped[bytes]

    @staticmethod
    def new(size: int):
        scramble_string = generate_scramble(size)

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


class Solve(db.Model):
    __tablename__ = "solve"

    id: Mapped[int] = mapped_column(primary_key=True)
    scramble_id: Mapped[int] = mapped_column(ForeignKey("scramble.id"))
    scramble: Mapped[Scramble] = relationship()

    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    user: Mapped[Optional[User]] = relationship()

    state: Mapped[bytes] = mapped_column(default=bytes())

    time: Mapped[Optional[int]] = mapped_column(default=0)
    completed: Mapped[bool] = mapped_column(default=False)
    inspection_startdate: Mapped[datetime]
    solve_startdate: Mapped[datetime]
    reattempt: Mapped[bool] = mapped_column(default=False)

    race_id: Mapped[Optional[int]] = mapped_column(ForeignKey("race.id"))
    race: Mapped[Optional["Race"]] = relationship(back_populates="solves")

    end_timestamp: Mapped[Optional[datetime]]

    lobby_together_id: Mapped[Optional[int]] = mapped_column(ForeignKey("together_lobby.id"))
    lobby_together: Mapped[Optional["TogetherLobby"]] = relationship()

    solving_sessions: Mapped[List["SolvingSession"]] = relationship()

    manually_saved: Mapped[bool] = mapped_column(default=False)
    deleted: Mapped[bool] = mapped_column(default=False)

    def is_ongoing(self) -> bool:
        return self.solving_sessions[-1].end is None

    def get_ongoing_time(self) -> int:
        # get time of an ongoing solve
        # self.time updates only on session end
        current_session = self.solving_sessions[-1]
        session_time = (datetime.now() - current_session.start) / timedelta(milliseconds=1)
        return self.time + session_time

    def add_move(self, move_str: str, timestamp: datetime) -> None:
        move = SolveMove(
            move=move_str,
            timestamp=timestamp,
            solving_session_id=self.solving_sessions[-1].id
        )
        db.session.add(move)
        db.session.commit()

    def add_camera_change(self, position) -> None:
        camera_change = CameraChange(
            x=position["x"],
            y=position["y"],
            z=position["z"],
            timestamp=datetime.now(),
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
                    "sinceStart": total_time + (move.timestamp - session.start) / timedelta(milliseconds=1),
                    "move": move.move
                })
            if session.end:
                c = ((session.end - session.start) / timedelta(milliseconds=1))
                total_time += c

        moves.sort(key=lambda move: move["sinceStart"])
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
        self.end_timestamp = timestamp
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

    solves: Mapped[List[Solve]] = relationship(back_populates="race")

    def end(self):
        now = datetime.now()
        # end all unfinished solves in the lobby
        for solve in self.solves:
            if solve.is_ongoing():
                solve.end_current_session(now)

        solves_sorted: List[Solve] = sorted(self.solves, key=lambda solve: solve.time)

        points = 10
        results = []
        for solve in solves_sorted:
            if not solve.completed:
                results.append({"username": solve.user.username, "time": None, "pointsDelta": 0})
            else:
                results.append({"username": solve.user.username, "time": solve.time, "pointsDelta": points})
                lobby_user = LobbyUser.get(solve.user_id, self.lobby_id)
                lobby_user.points = lobby_user.points + points
                points -= 1

        socketio.emit(
            "lobby_race_done",
            {"results": results, "lobbyPoints": self.lobby.get_user_points()},
            room=self.lobby_id
        )
        self.ongoing = False
        db.session.commit()

    def end_race_if_finished(self):
        # get number of users in the lobby that are still solving the cube
        still_solving = len(list(filter(lambda solve: solve.is_ongoing(), self.solves)))

        if (still_solving == 0):
            self.end()


class TogetherUser(db.Model):
    __tablename__ = "together_user"
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id"),
        primary_key=True
    )
    user: Mapped[User] = relationship()

    together_lobby_id: Mapped[int] = mapped_column(
        ForeignKey("together_lobby.id"),
        primary_key=True
    )


class TogetherLobby(db.Model):
    __tablename__ = "together_lobby"
    id: Mapped[int] = mapped_column(primary_key=True)

    creator_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    creator: Mapped[User] = relationship()

    cube_id: Mapped[int] = mapped_column(ForeignKey("cube.id"))
    cube: Mapped["CubeEntity"] = relationship()

    users: Mapped[List[TogetherUser]] = relationship()

    def get_room(self) -> str:
        # get socketio room id
        return f"together/{self.id}"


class SocketConnection(db.Model):
    __tablename__ = "socket_connection"
    id: Mapped[int] = mapped_column(primary_key=True)
    socket_id: Mapped[str]
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    user: Mapped[User] = relationship()

    connection_date: Mapped[datetime] = mapped_column(insert_default=func.now())
    disconnection_date: Mapped[Optional[datetime]]

    cube_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cube.id"))
    cube: Mapped["CubeEntity"] = relationship()

    lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Optional[Lobby]] = relationship()

    together_lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("together_lobby.id"))
    together_lobby: Mapped[Optional[TogetherLobby]] = relationship()


    @staticmethod
    def get(sid: str) -> "SocketConnection":
        connection = db.session.scalar(
            select(SocketConnection).where(SocketConnection.socket_id == sid)
        )
        return connection


class CubeEntity(db.Model):
    __tablename__ = "cube"
    id: Mapped[int] = mapped_column(primary_key=True)
    size: Mapped[int]
    state: Mapped[bytes]
    current_solve_id: Mapped[Optional[int]] = mapped_column(ForeignKey("solve.id"))
    current_solve: Mapped[Optional[Solve]] = relationship()

    def make_move(self, move_str: str, timestamp: datetime):
        # get new cube state after the move
        cube = Cube(self.size, self.state)
        cube.move(move_str)
        new_state = cube.serialize()
        is_solved = cube.is_solved()

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

class InvitationRet(TypedDict):
    type: str
    id: int

class Invitation(db.Model):
    __tablename__ = "invitation"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[UUID] = mapped_column(default=uuid4)

    lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lobby.id"))
    lobby: Mapped[Optional[Lobby]] = relationship()

    together_lobby_id: Mapped[Optional[int]] = mapped_column(ForeignKey("together_lobby.id"))
    together_lobby: Mapped[Optional[TogetherLobby]] = relationship()

    created_by_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    created_by: Mapped[User] = relationship()
    active: Mapped[bool] = mapped_column(default=True)

    @staticmethod
    def create(created_by: str, id: int, type: str) -> "Invitation":
        assert type in ["together", "lobby"]

        invitation = Invitation()
        invitation.created_by = User.get(created_by)
        if type == "together":
            invitation.together_lobby_id = id
        else:
            invitation.lobby_id = id

        db.session.add(invitation)
        db.session.commit()
        return invitation

    @staticmethod
    def get_lobby(uuid_str: str) -> InvitationRet:
        invitation = db.session.scalars(
            select(Invitation).where(Invitation.url == UUID(uuid_str))
        ).one_or_none()
        if not invitation:
            return None

        if invitation.lobby_id:
            type = "lobby"
            id = invitation.lobby_id
        elif invitation.together_lobby_id:
            type = "together"
            id = invitation.together_lobby_id
        else:
            assert False

        return { "type": type, "id": id }


def setup_admin():
    import os
    from dotenv import load_dotenv

    load_dotenv()

    admin_username = os.environ.get("ADMIN_USERNAME")

    user = db.session.scalars(
        select(User).where(User.username == admin_username)
    ).one_or_none()

    if user is None:


        user = User(
            username=admin_username,
            password_hash=generate_password_hash(os.environ.get("ADMIN_PASSWORD")),
            role=UserRole.ADMIN
        )
        db.session.add(user)
        db.session.commit()

def tidy_db():
    db.session.execute(
        update(Lobby).where(Lobby.status != LobbyStatus.ENDED).values(status = LobbyStatus.ENDED)
    )
    db.session.commit()