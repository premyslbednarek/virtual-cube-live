from dataclasses import dataclass
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from enum import Enum

class LobbyStatus(Enum):
    ACTIVE = 0
    DISCONNECTED = 1
    READY = 2
    SOLVING = 3
    SOLVED = 4


db = SQLAlchemy()

class Solve(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    layers = db.Column(db.Integer)
    scramble = db.Column(db.String(128))
    solution = db.Column(db.Text)
    time = db.Column(db.Text)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True)
    password_hash = db.Column(db.String(128))

class Lobby(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    creator = db.Column(db.Integer)

class LobbyUsers(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lobby_id = db.Column(db.Integer)
    user_id = db.Column(db.Integer)
    ready = db.Column(db.Integer, default=0)
    state = db.Column(db.BLOB)
    sid = db.Column(db.Integer)
    status = db.Column(db.Enum(LobbyStatus))
