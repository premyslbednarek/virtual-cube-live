import { useParams } from "react-router-dom"
import { useRef, useEffect, useState } from "react"
import Cube from "../cube/cube";
import {
    Box,
    Grid
} from "@mantine/core"
import * as THREE from 'three';
import { io } from "socket.io-client";
import { socket } from "../socket";

function CubeCanvas(props: any) {
    const canvasRef = useRef(null);
    const lobby_id = props.lobby_id;

    useEffect(() => {
        const canvas = canvasRef.current;
        console.log(canvas)
        const cube = new Cube(3, canvas as any);
        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();
    })

    return <canvas style={{width: "100%", height: "100%" }} ref={canvasRef}></canvas>

}

function EnemyCubes({lobby_id} : {lobby_id : number}) {
    const [enemies, setEnemies] = useState<Map<string, number>>(new Map());

    const onConnection = ({username} : {username: string}) => {
        console.log(username, "has joined the lobby");
        setEnemies(new Map(enemies.set(username, 0)));
    };

    const onDisconnection = ({username} : {username: string}) => {
        console.log(username, "has left the lobby");
        console.log(enemies.delete(username));
        setEnemies(new Map(enemies));
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
                    m.set(username, 0);
                });
                setEnemies(m);
            }
        )
    }, []);


    useEffect(() => {
        socket.on("lobby_connection", onConnection);
        socket.on("lobby_disconnection", onDisconnection)

        return () => {
            socket.off("lobby_connection", onConnection);
            socket.off("lobby_disconnection", onDisconnection)
        }
    })

    return (
        <>
            { [...enemies.keys()].map(enemy => <div key={enemy}>{enemy}</div>)}
        </>
    );
}

export default function Lobby() {
    const params = useParams();

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        return () => {
            console.log("disconnection from socket...")
            socket.disconnect();
        };
    }, [])

    return (
        <>
            <p>{params.lobby_id}</p>
            <Grid>
              <Grid.Col span={9}>
                <CubeCanvas lobby_id={params.lobby_id} />
              </Grid.Col>
              <Grid.Col span={3}>
                <EnemyCubes lobby_id={params.lobby_id ? Number(params.lobby_id) : -1} />
              </Grid.Col>
            </Grid>
        </>
    );
}