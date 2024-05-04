from app import app, socketio

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

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)