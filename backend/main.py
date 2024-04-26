import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager
from model import db

from dotenv import load_dotenv
import os
load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.db' # Using SQLite as the database
app.config['SECRET_KEY'] = "secret"

PRODUCTION = "prod"
mode = os.environ.get("MODE", PRODUCTION)
print(mode)

login_manager = LoginManager()
login_manager.init_app(app)

db.init_app(app)
with app.app_context():
    db.create_all()

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=True)

# import paths from views.py
import views

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)