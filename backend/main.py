from app import app, socketio, logger
import logging

from model import db, setup_admin, tidy_db
# db = SQLAlchemy()
db.init_app(app)

with app.app_context():
    db.create_all()

with app.app_context():
    setup_admin()
    tidy_db()

import api
import cube_events
import together_lobby

if __name__ == '__main__':
    handler = logging.FileHandler("app2.log")
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.DEBUG)

    eventletlogger = logging.getLogger('eventlet')
    eventletlogger.addHandler(handler)
    eventletlogger.setLevel(logging.DEBUG)

    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.addHandler(handler)

    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)

    socketio.run(app, host="localhost", port=8080, debug=True)