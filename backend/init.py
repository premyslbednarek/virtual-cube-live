import eventlet
eventlet.monkey_patch()
from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
import os
import logging

logger = logging.getLogger(__name__)

app = Flask(__name__)

db = SQLAlchemy()

conn_url = f"postgresql://" \
           f"{os.environ.get('DB_USERNAME')}" \
           f":{os.environ.get('DB_PASSWORD')}" \
           f"@{os.environ.get('DB_HOST')}:{os.environ.get('DB_PORT')}" \
           f"/{os.environ.get('DB_NAME')}"

app.config['SQLALCHEMY_DATABASE_URI'] = conn_url
app.config['SECRET_KEY'] = os.environ.get("APP_SECRET")

app.config['MAIL_SERVER'] = os.environ.get("MAIL_SERVER")
app.config['MAIL_PORT'] = os.environ.get("MAIL_PORT")
app.config['MAIL_USE_SSL'] = os.environ.get("MAIL_USE_SSL")
app.config['MAIL_USERNAME'] = os.environ.get("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.environ.get("MAIL_PASSWORD")

mail = Mail(app)

login_manager = LoginManager()
login_manager.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=logger, logger=logger)
