import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager

from dotenv import load_dotenv
import os
load_dotenv()

import logging

logger = logging.getLogger(__name__)

conn_url = f"postgresql://" \
           f"{os.environ.get('DB_USERNAME')}" \
           f":{os.environ.get('DB_PASSWORD')}" \
           f"@db:{os.environ.get('DB_PORT')}" \
           f"/{os.environ.get('DB_NAME')}"

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = conn_url
app.config['SECRET_KEY'] = os.environ.get("APP_SECRET")

PRODUCTION = "prod"
mode = os.environ.get("MODE", PRODUCTION)

login_manager = LoginManager()
login_manager.init_app(app)

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=logger, logger=logger)
