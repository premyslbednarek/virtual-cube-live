import { useEffect, useMemo } from "react";
import Cube from "../cube/cube";
import { ControlledCube } from "./CubeCanvases";
import NavigationPanel from "./NavigationPanel";
import { socket } from "../socket";
import * as THREE from 'three';


export default function SoloMode() {
    const cube = useMemo(() => new Cube(3), []);

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();


        function send_move(move_str: string) {
            const data = {
                move: move_str
            }
            socket.emit("lobby_move", data);
        }

        function send_camera(new_position: THREE.Vector3) {
            const data = {
                position: new_position
            }
            socket.emit("lobby_camera", data);
        }

        cube.onMove(send_move);
        cube.onCamera(send_camera);

        return () => {
            cube.remove_keyboard_controls();
            console.log("disconnection from socket...")
            socket.disconnect();
        };
        // eslint-disable-next-line
    }, [cube])

    return (
        <>
            <div style={{position: "absolute"}}>
                <NavigationPanel />
            </div>
            <div style={{height: "100vh"}}>
                <ControlledCube cube={cube} />
            </div>
        </>
    );
}