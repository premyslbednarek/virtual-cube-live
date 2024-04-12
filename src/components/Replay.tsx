import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom"
import { RenderedCube } from "./Lobby";
import { Button, Text, Space, Slider } from "@mantine/core";
import Cube from "../cube/cube";
import useFetch from "@custom-react-hooks/use-fetch";

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
    scramble_state: string;
    moves: Array<IMoveInfo>;
    camera_changes: Array<ICameraInfo>;
    completed: boolean;
    time: number;
}

const defaultSolveInfo: ISolveInfo = {
    cube_size: 3,
    scramble: "",
    scramble_state: "",
    moves: [],
    camera_changes: [],
    completed: false,
    time: 0,
}

function renderTime(time: number) {
    const ms = Math.round(time % 1000);
    const timeSec = Math.floor(time / 1000);
    const sec = timeSec % 60;
    const minutes = Math.floor(timeSec / 60)
    return <div>{((minutes > 0) ? minutes + ":" : "") +
            sec.toString().padStart(2, '0') + ":" +
            ms.toString().padStart(3, '0')
    }</div>
}

const UPDATE_INTERVAL = 53; // in ms

export default function Replay() {
    const { solveId } = useParams();

    // track current time in replay in ms
    const [time, setTime] = useState(0);
    const [paused, setPaused] = useState(false);

    const { data, loading, error } = useFetch<ISolveInfo>(`/api/solve/${solveId}`);
    const solve = data ? data : defaultSolveInfo;
    // const [solve, setSolve] = useState<ISolveInfo>(defaultSolveInfo)
    const cube = useMemo(() => new Cube(solve.cube_size), [])
    const navigate = useNavigate();

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
        if (!paused) {
            const interval = setInterval(() => setTime(time => time + UPDATE_INTERVAL), UPDATE_INTERVAL);
            return () => {
                clearInterval(interval);
            }
        }
    }, [paused])

    useEffect(() => {
        if (solve.time != 0 && time > solve.time) {
            console.log(time, solve.time)
            setPaused(true);
            // this is a hack
            setTime(solve.time + 100);
        }
    }, [time, solve.time])

    useEffect(() => {
        for (const move of solve.moves) {
            if (move.sinceStart > time + UPDATE_INTERVAL) break;
            if (time <= move.sinceStart && move.sinceStart <= time + UPDATE_INTERVAL) {
                setTimeout(() => {cube.makeMove(move.move)}, move.sinceStart - time);
            }
        }
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart > time + UPDATE_INTERVAL) break;
            if (time <= cameraChange.sinceStart && cameraChange.sinceStart <= time + UPDATE_INTERVAL) {
                setTimeout(() => {cube.cameraUpdate(cameraChange.x, cameraChange.y, cameraChange.z)}, cameraChange.sinceStart - time);
            }
        }

    }, [time]);

    useEffect(() => {
        cube.setState(solve.scramble_state);
    }, [solve])

    const onPlayButtonClick = () => {
        if (time == solve.time) {
            setPaused(false);
            setTime(0);
        } else {
            setPaused(paused => !paused);
        }
    }

    const onSliderValueChange = (time: number) => {
        cube.setState(solve.scramble_state);
        for (const move of solve.moves) {
            if (move.sinceStart < time) {
                cube.makeMove(move.move);
            }
        }
        cube.animationForceEnd();
        let x = 0, y = 0, z = 0;
        let cameraChanged = false;
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart < time) {
                cameraChanged = true;
                x = cameraChange.x;
                y = cameraChange.y;
                z = cameraChange.z;
            }
        }
        if (cameraChanged) {
            cube.cameraUpdate(x, y, z);

        }
        setTime(time);
    }

    if (loading) {
        return <div>Loading ...</div>;
    }

    if (error) {
        return <div>Error ...</div>
    }


    return (
        <>
            <div style={{position: "absolute", fontSize: "30px", margin: 10}}>
                <div style={{display: "flex"}}>
                    <Button onClick={() => navigate(-1)}>Go back</Button>
                    <Space w="sm" />
                    <Button onClick={() => navigate("/")}>Home</Button>
                </div>
                <Text size="2xl">
                    Scramble: {solve.scramble}
                </Text>
                <div>{solve.completed ? "Completed" : "Not completed"} {solve.completed ? renderTime(solve.time) : ""} </div>

            </div>
            <RenderedCube cube={cube} style={{height: "100vh"}}/>
            <div style={{position: "absolute", width: "100vw", bottom: "8vh", textAlign: "center"}}>
                <div style={{ width: "80%", margin: "0 auto"}}>
                    <div>Time: {renderTime(time)}</div>
                    <Slider
                        min={0}
                        max={solve.time}
                        value={time}
                        label={renderTime}
                        onChange={onSliderValueChange}
                    ></Slider>
                    <Button onClick={onPlayButtonClick}>{paused ? "play" : "pause"}</Button>
                </div>
            </div>
        </>
    )
}