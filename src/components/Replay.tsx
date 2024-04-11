import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom"
import { RenderedCube } from "./Lobby";
import Cube from "../cube/cube";

interface IMoveInfo {
    move: string;
    sinceStart: number;
}

interface ICameraInfo {
    x: number;
    y: number;
    z: number;
    sinceStart: number;
}

interface ISolveInfo {
    cube_size: number;
    scramble: string;
    moves: Array<IMoveInfo>;
    camera_changes: Array<ICameraInfo>;
}

const defaultSolveInfo: ISolveInfo = {
    cube_size: 3,
    scramble: "",
    moves: [],
    camera_changes: []
}

export default function Replay() {
    const { solveId } = useParams();

    const [solve, setSolve] = useState<ISolveInfo>(defaultSolveInfo)
    const cube = useMemo(() => new Cube(solve.cube_size), [])

    async function replayCamera() {
        let lastTimeC = 0;
        for (const {x, y, z, sinceStart} of solve.camera_changes) {
            await new Promise(r => setTimeout(r, sinceStart - lastTimeC));
            console.log("ZMENA")
            cube.camera.position.x = x;
            cube.camera.position.y = y;
            cube.camera.position.z = z;
            cube.camera.lookAt(0, 0, 0);
            cube.render();
            lastTimeC = sinceStart;
        }
    }

    async function replayMoves() {
        // replay the solve
        let lastTime = 0;
        for (const {move, sinceStart} of solve.moves) {
            await new Promise(r => setTimeout(r, sinceStart - lastTime));
            cube.makeMove(move)
            lastTime = sinceStart;
        }
    }


    useEffect(() => {
        fetch("/api/solve/" + solveId).then(res => res.json()).then((solve: ISolveInfo) => {
            console.log(solve);
            setSolve(solve);
        })
    }, [])

    useEffect(() => {
        const scramble = solve.scramble.split(' ')
        for (const move of scramble) {
            cube.makeMove(move);
        }

        replayMoves();
        replayCamera();
    })


    return (
        <>
            <RenderedCube cube={cube} style={{height: "100vh"}}/>
        </>
    )
}