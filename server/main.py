# https://python-socketio.readthedocs.io/en/latest/server.html
# code from https://tutorialedge.net/python/python-socket-io-tutorial/
from aiohttp import web
import socketio

## creates a new Async Socket IO Server
sio = socketio.AsyncServer(cors_allowed_origins="*") # cors error without cors_allowed origins
## Creates a new Aiohttp Web Application
app = web.Application()
# Binds our Socket.IO server to our Web App
## instance
sio.attach(app)

## we can define aiohttp endpoints just as we normally
## would with no change
async def index(request):
    with open('index.html') as f:
        return web.Response(text=f.read(), content_type='text/html')

sidToName = {}
i = 0

## If we wanted to create a new websocket endpoint,
## use this decorator, passing in the name of the
## event we wish to listen out for
@sio.on('message')
async def print_message(sid, message):
    ## When we receive a new event of type
    ## 'message' through a socket.io connection
    ## we print the socket ID and the message
    print("Socket ID: " , sid)
    print("Incoming message: ", message)
    await sio.emit("ack", "the server has gotten the message")


@sio.on('ack')
async def print_ack(sid, message):
    print("The client has gotten the message.")

@sio.on("move")
async def distributeMove(sid, message):
    await sio.emit("opponentMove", message, skip_sid=sid)

@sio.on("camera")
async def distributeCamera(sid, message):
    await sio.emit("opponentCamera", message, skip_sid=sid)

@sio.event
async def connect(sid, environ, auth):
    global i
    print('connect ', sid)
    sidToName[sid] = i
    i += 1
    print("Sending welcoming message...")
    await sio.emit("message", f"Welcome to the server. Your session user id is {sidToName[sid]}", to=sid)
    await sio.emit("welcome", {"users": len(sidToName) - 1}, to=sid)
    await sio.emit("message", f"User with session id {sidToName[sid]} has connected.", skip_sid=sid)
    await sio.emit("connection", "", skip_sid=sid)
    print("Welcoming message sent...")

@sio.event
async def disconnect(sid):
    print('disconnect ', sid)
    await sio.emit("message", f"User with session id {sidToName[sid]} has disconnected.")
    del sidToName[sid]


## We bind our aiohttp endpoint to our app
## router
app.router.add_get('/', index)

## We kick off our server
if __name__ == '__main__':
    web.run_app(app)