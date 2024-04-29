from app import app, socketio

from model import db, setup_admin
# db = SQLAlchemy()
db.init_app(app)

with app.app_context():
    db.create_all()

with app.app_context():
    setup_admin()

# import paths from views.py
import views

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)