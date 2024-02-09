from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO
import sqlite3

app = Flask(__name__)

# https://github.com/miguelgrinberg/Flask-SocketIO/issues/1356#issuecomment-681830773
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=True)

sidToName = {}
i = 0

@app.route('/')
def index():
    return send_from_directory("../client", "index.html")

@app.route('/js/<path:path>')
def js(path):
    return send_from_directory("../client/js", path)

@app.route('/style/<path:path>')
def style(path):
    return send_from_directory("../client/style", path)


@socketio.on('message')
def print_message(message):
    print("Socket ID: " , request.sid)
    print("Incoming message: ", message)
    socketio.emit("ack", "the server has gotten the message")


@socketio.on('ack')
def print_ack(message):
    print("ACK", message)
    print("The client has gotten the message.")

@socketio.on("move")
def distributeMove(message):
    socketio.emit("opponentMove", [sidToName[request.sid], message], skip_sid=request.sid)

@socketio.on("layersChange")
def distributeMove(newLayers):
    print(f"{sidToName[request.sid]} changed cube to {newLayers}x{newLayers}")
    socketio.emit("opponentLayers", [sidToName[request.sid], newLayers], skip_sid=request.sid)

@socketio.on("camera")
def distributeCamera(message):
    socketio.emit("opponentCamera", [sidToName[request.sid], message], skip_sid=request.sid)

@socketio.on("reset")
def distributeReset():
    socketio.emit("opponentReset", [sidToName[request.sid]], skip_sid=request.sid)

@socketio.on("uploadSolve")
def insertSolve(data):
    print(data)
    con = sqlite3.connect("database.db")
    cur = con.cursor()
    cur.execute("INSERT INTO solves (solve, layers, time) VALUES (?, ?, ?)", [data["solve"], data["layers"], data["timeString"]])
    con.commit()
    con.close()
    # return ID of inserted row
    return cur.lastrowid

@socketio.on("getSolve")
def getSolve(id):
    con = sqlite3.connect("database.db")
    cur = con.cursor()
    cur.execute("SELECT solve FROM solves WHERE id=?", [id])
    res = cur.fetchone()[0]
    cur.close()
    con.close()
    return res



@socketio.event
def connect():
    global i
    print('connect ', request.sid)
    connected_users = list(sidToName.values())
    sidToName[request.sid] = i
    i += 1
    print("Sending welcoming message...")
    socketio.emit("message", f"Welcome to the server. Your session user id is {sidToName[request.sid]}", to=request.sid)
    socketio.emit("welcome", {"nUsers": len(sidToName) - 1, "usersIds": connected_users}, to=request.sid)
    socketio.emit("message", f"User with session id {sidToName[request.sid]} has connected.", skip_sid=request.sid)
    socketio.emit("connection", sidToName[request.sid], skip_sid=request.sid)
    print("Welcoming message sent...")

@socketio.event
def disconnect():
    print('disconnect ', request.sid)
    socketio.emit("message", f"User with session id {sidToName[request.sid]} has disconnected.")
    socketio.emit("disconnection", sidToName[request.sid])
    del sidToName[request.sid]

if __name__ == '__main__':
    socketio.run(app, host="localhost", port=8080, debug=True)