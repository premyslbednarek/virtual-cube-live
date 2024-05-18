from api import send_email
from flask_mail import Message
from threading import Thread
from init import app, db, logger
from model import ANONYMOUS_PREFIX, User
from typing import Optional

from flask import abort, flash, render_template, request
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import func, select
from werkzeug.security import check_password_hash, generate_password_hash


import json


@app.route('/api/login', methods=["POST"])
def login():
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


@app.route('/api/register', methods=["POST"])
def register():
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