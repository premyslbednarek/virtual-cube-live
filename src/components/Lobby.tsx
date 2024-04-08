import { useParams } from "react-router-dom"
import { useRef, useEffect, useState } from "react"
import Cube from "../cube/cube";
import { Box } from "@mantine/core"
import * as THREE from 'three';
import { io } from "socket.io-client";

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

export default function Lobby() {
    const params = useParams();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const socket = io();
        socket.emit("lobby_connect", { lobby_id: params.lobby_id }, function(data: any) {
            const status = data.code
            if (status === 1) {
                alert("You have already joined this lobby.");
                return;
            }

            const userList = data.userList
            userList.forEach((user: string) => { console.log(user)});
        })

        // setSocket(socket);

        return () => { socket.close() };
    })

    return (
        <>
            <p>{params.lobby_id}</p>
            <Box>
              <CubeCanvas lobby_id={params.lobby_id} />
            </Box>
        </>
    );
}