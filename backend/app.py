import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager
from flask_mail import Mail

from dotenv import load_dotenv
import os
load_dotenv()

import logging

logger = logging.getLogger(__name__)

conn_url = f"postgresql://" \
           f"{os.environ.get('DB_USERNAME')}" \
           f":{os.environ.get('DB_PASSWORD')}" \
           f"@{os.environ.get('SOURCE', 'db')}:{os.environ.get('DB_PORT')}" \
           f"/{os.environ.get('DB_NAME')}"

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = conn_url
app.config['SECRET_KEY'] = os.environ.get("APP_SECRET")

app.config['MAIL_SERVER'] = os.environ.get("MAIL_SERVER")
app.config['MAIL_PORT'] = os.environ.get("MAIL_PORT")
app.config['MAIL_USE_SSL'] = os.environ.get("MAIL_USE_SSL")
app.config['MAIL_USERNAME'] = os.environ.get("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.environ.get("MAIL_PASSWORD")
mail = Mail(app)

PRODUCTION = "prod"
mode = os.environ.get("MODE", PRODUCTION)

login_manager = LoginManager()
login_manager.init_app(app)

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=logger, logger=logger)
