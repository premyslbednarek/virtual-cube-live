import { useParams } from "react-router-dom"
import { useRef, useEffect } from "react"
import Cube from "../cube/cube";

function CubeCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        console.log(canvas)
        const cube = new Cube(3, canvas as any);
        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();
    })

    return <canvas ref={canvasRef}></canvas>

}

export default function Lobby() {
    const params = useParams();
    return (
        <>
            <p>{params.lobby_id}</p>
            <CubeCanvas />
        </>
    );
}