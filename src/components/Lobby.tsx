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

type Enemy = {
    cube: Cube,
    readyStatus: boolean
}

function RenderedCube({cube} : {cube: Cube}) {
    const containerRef = useRef(null);

    useEffect(() => {
        cube.mount(containerRef.current);
    })

    return (
        <div ref={containerRef}></div>
    );
}

function DisplayEnemy({username, enemy} : {username: string, enemy: Enemy}) {
    const readyColor = enemy.readyStatus ? "green" : "red";
    const readyText = enemy.readyStatus ? "  READY" : "UNREADY"
    return (
        <div key={username}>
            <div className="absolute">
                <Badge mt="sm" ml="sm" mr="sm">{username}</Badge>
                <Badge color={readyColor}>{readyText}</Badge>
            </div>
            <RenderedCube cube={enemy.cube} />
        </div>
    );
}

export default function Lobby() {
    const params = useParams();
    const lobby_id = params.lobby_id;

    const [ready, setReady] = useState(false);
    const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());

    const cube = useMemo(() => new Cube(3), []);


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
        cube.cube.makeMove(move);
    }

    const onCamera = (data: any) => {
        const username = data.username;
        const position = data.position;

        const cube = enemies.get(username);
        if (!cube) {
            return;
        }

        cube.cube.updateCamera(position);
    };

    const onReadyChange = ({ready_status, username} : {ready_status: boolean, username: string}) => {
        const updated = new Map(enemies);
        console.log(enemies);
        const enemy = updated.get(username);
        if (!enemy) return;
        enemy.readyStatus = ready_status;
        console.log(enemies);
        setEnemies(updated);
    }

    const onConnection = ({username} : {username: string}) => {
        console.log(username, "has joined the lobby");
        setEnemies(new Map(enemies.set(username, {cube: new Cube(3), readyStatus: false})));
    };

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();


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
                    m.set(username, {cube: new Cube(3), readyStatus: false});
                });
                setEnemies(m);
            }
        )

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
        socket.on("lobby_connection", onConnection);
        socket.on("lobby_disconnection", onDisconnection)

        return () => {
            cube.remove_keyboard_controls();
            console.log("disconnection from socket...")
            socket.off("lobby_connection", onConnection);
            socket.off("lobby_disconnection", onDisconnection)
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

    useEffect(() => {
        socket.on("lobby_ready_status_", onReadyChange);
        socket.on("lobby_move", onMove);
        socket.on("lobby_camera", onCamera);
        return () => {
            socket.off("lobby_ready_status_", onReadyChange);
            socket.off("lobby_move", onMove);
            socket.off("lobby_camera", onCamera);
        }
    })

    const readyColor = ready ? "green" : "red";
    const readyText = "YOU ARE " + (ready ? "  READY" : "UNREADY") + " (PRESS TO TOGGLE)";


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
              </Grid.Col>
              <Grid.Col span={3}>
             { [...enemies.entries()].map(([username, enemy]) => {
                return <DisplayEnemy key={username} username={username} enemy={enemy} />
             })
             }
              </Grid.Col>
            </Grid>
            <div className="readyButton">
                <Button color={readyColor} onClick={onReadyClick}>{readyText}</Button>
            </div>
        </div>
    );
}