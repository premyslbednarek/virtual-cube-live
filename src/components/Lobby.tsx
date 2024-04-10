import { useParams, Link } from "react-router-dom"
import React, { useRef, useEffect, useState, useMemo } from "react"
import Cube from "../cube/cube";
import {
    Box,
    Grid,
    Badge,
    Button
} from "@mantine/core"
import * as THREE from 'three';
import { io } from "socket.io-client";
import { socket } from "../socket";
import './lobby.css'

function RenderedCube({cube} : {cube: Cube}) {
    const containerRef = useRef(null);

    useEffect(() => {
        cube.mount(containerRef.current);
    })

    return (
        <div ref={containerRef}></div>
    );
}

function CubeCanvas(props: any) {
    const canvasRef = useRef(null);
    const lobby_id = props.lobby_id;

    useEffect(() => {
        props.cube.mount(canvasRef.current);
    })

    return <div style={{}}ref={canvasRef}></div>
}

function OurCube({lobby_id} : {lobby_id: number}) {
    const [cube, setCube] = useState(new Cube(3));
    cube.init_keyboard_controls();
    cube.init_camera_controls();
    cube.init_mouse_moves();

    function send_move(move_str: string) {
        const data = {
            lobby_id: lobby_id,
            move: move_str
        }
        socket.emit("lobby_move", data);
    }

    function send_camera(new_position: THREE.Vector3) {
        const data = {
            lobby_id: lobby_id,
            position: new_position
        }
        socket.emit("lobby_camera", data);
    }

    cube.onMove(send_move);
    cube.onCamera(send_camera);

    return (
        <CubeCanvas cube={cube} />
    );

}

function EnemyCubes({lobby_id} : {lobby_id : number}) {
    const [enemies, setEnemies] = useState<Map<string, Cube>>(new Map());

    const onConnection = ({username} : {username: string}) => {
        console.log(username, "has joined the lobby");
        setEnemies(new Map(enemies.set(username, new Cube(3))));
    };

    const onDisconnection = ({username} : {username: string}) => {
        console.log(username, "has left the lobby");
        console.log(enemies.delete(username));
        setEnemies(new Map(enemies));
    };

    const onMove = ({username, move} : {username: string, move: string}) => {
        const cube = enemies.get(username);
        if (!cube) {
            return;
        }
        cube.makeMove(move);
    }

    const onCamera = (data: any) => {
        const username = data.username;
        const position = data.position;

        const cube = enemies.get(username);
        if (!cube) {
            return;
        }

        cube.updateCamera(position);
    };

    useEffect(() => {
        socket.emit("lobby_connect",
            { lobby_id: lobby_id },
            function(data: any) {
                const status = data.code
                if (status === 1) {
                    alert("You have already joined this lobby.");
                    return;
                }

                const m = new Map(enemies);
                data.userList.forEach((username: string) => {
                    m.set(username, new Cube(3));
                });
                setEnemies(m);
            }
        )
    }, []);


    useEffect(() => {
        socket.on("lobby_connection", onConnection);
        socket.on("lobby_disconnection", onDisconnection)
        socket.on("lobby_move", onMove);
        socket.on("lobby_camera", onCamera);

        return () => {
            socket.off("lobby_connection", onConnection);
            socket.off("lobby_disconnection", onDisconnection)
            socket.off("lobby_move", onMove);
            socket.off("lobby_camera", onCamera);
        }
    })

    return (
        <>
            { [...enemies.entries()].map(([username, cube]) => {
                return (
                    <div key={username}>
                        <Badge className="absolute" mt="sm" ml="sm">{username}</Badge>
                        <RenderedCube cube={cube} />
                    </div>
                );
            })
            }
        </>
    );
}

export default function Lobby() {
    const params = useParams();
    const lobby_id = params.lobby_id;

    const [ready, setReady] = useState(false);

    const cube = useMemo(() => new Cube(3), []);

    const onReadyChange = (data: any) => {
        console.log(data.username, "is", data.ready_status);
    }

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")
        socket.on("lobby_ready_status_", onReadyChange)

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();

        function send_move(move_str: string) {
            const data = {
                lobby_id: lobby_id,
                move: move_str
            }
            socket.emit("lobby_move", data);
        }

        function send_camera(new_position: THREE.Vector3) {
            const data = {
                lobby_id: lobby_id,
                position: new_position
            }
            socket.emit("lobby_camera", data);
        }

        cube.onMove(send_move);
        cube.onCamera(send_camera);

        return () => {
            console.log("disconnection from socket...")
            socket.off("lobby_ready_status", onReadyChange)
            socket.disconnect();
        };
    }, [])

    const onReadyClick = () => {
        socket.emit(
            "lobby_ready_status",
            {lobby_id: lobby_id, ready_status: !ready}
        )
        setReady(!ready);
    }

    const readyColor = ready ? "green" : "red";
    const readyText = (ready ? "  READY" : "UNREADY") + " (PRESS TO TOGGLE)";


    return (
        <div>
          <div>
            <Link className="App-link" to="/">Home</Link>
            &nbsp;|&nbsp;
            <Link className="App-link" to="/page2">Page2</Link>
          </div>
            <p>{params.lobby_id}</p>
            <Grid>
              <Grid.Col span={9}>
                <RenderedCube cube={cube} />
                {/* <OurCube lobby_id={params.lobby_id ? Number(params.lobby_id) : -1}/> */}
              </Grid.Col>
              <Grid.Col span={3}>
                <EnemyCubes lobby_id={params.lobby_id ? Number(params.lobby_id) : -1} />
              </Grid.Col>
            </Grid>
            <div className="readyButton">
                <Button color={readyColor} onClick={onReadyClick}>{readyText}</Button>
            </div>
        </div>
    );
}