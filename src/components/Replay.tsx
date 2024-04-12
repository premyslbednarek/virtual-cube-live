import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom"
import { RenderedCube } from "./Lobby";
import { Text, Space, Slider, ActionIcon, Center, Tooltip, Flex, Kbd } from "@mantine/core";
import Cube from "../cube/cube";
import useFetch from "@custom-react-hooks/use-fetch";
import { useHotkeys } from "react-hotkeys-hook";
import {IconPlayerPlay, IconPlayerPause, IconRewindBackward5, IconRewindForward5, IconHome, IconArrowLeft, IconPlus, IconMinus, IconReload} from "@tabler/icons-react"

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
    const [time, setTime] = useState(0); // current time in ms
    const [paused, setPaused] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const navigate = useNavigate();
    const { data, loading, error } = useFetch<ISolveInfo>(`/api/solve/${solveId}`);
    const solve = data ? data : defaultSolveInfo;
    const cube = useMemo(() => {
        const cube = new Cube(solve.cube_size);
        cube.setState(solve.scramble_state);
        return cube;
    }, [solve])

    // advance in time when the replay is not paused
    useEffect(() => {
        if (!paused) {
            const interval = setInterval(() => {
                setTime(time => time + UPDATE_INTERVAL * playbackSpeed)
            }, UPDATE_INTERVAL);
            return () => {
                clearInterval(interval);
            }
        }
    }, [paused, playbackSpeed])

    // stop timer after reaching end of the solve
    useEffect(() => {
        if (solve.time !== 0 && time > solve.time) {
            console.log(time, solve.time)
            setPaused(true);
            // this is a hack
            setTime(solve.time + 100);
        }
    }, [time, solve.time])

    // apply moves/camera changes that happen until next time change
    useEffect(() => {
        for (const move of solve.moves) {
            if (move.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= move.sinceStart && move.sinceStart <= time + UPDATE_INTERVAL * playbackSpeed) {
                setTimeout(() => {cube.makeMove(move.move)}, (move.sinceStart - time) / playbackSpeed);
            }
        }
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= cameraChange.sinceStart && cameraChange.sinceStart <= time + UPDATE_INTERVAL * playbackSpeed) {
                setTimeout(() => {cube.cameraUpdate(cameraChange.x, cameraChange.y, cameraChange.z)}, (cameraChange.sinceStart - time) / playbackSpeed);
            }
        }

    }, [time, playbackSpeed, cube, solve]);

    const onPlayButtonClick = () => {
        if (time > solve.time) {
            setPaused(false);
            manualTimeChange(0);
        } else {
            setPaused(paused => !paused);
        }
    }

    function changeTime(delta: number) {
        let newTime = time + delta;
        if (newTime < 0) newTime = 0;
        if (newTime > solve.time) newTime = solve.time;
        manualTimeChange(newTime);
    }

    useHotkeys("space", () => setPaused(paused => !paused));
    useHotkeys("left", () =>  changeTime(-5000), [time]);
    useHotkeys("right", () => changeTime(5000), [time]);

    // when changing time by hand, we have to replay all moves and camera changes
    // that happened until that moment
    const manualTimeChange = (newTime: number) => {
        cube.animationForceEnd(); // stop possible animations
        cube.setState(solve.scramble_state); // set initial cube state

        // replay all the moves
        for (const move of solve.moves) {
            if (move.sinceStart < newTime) {
                cube.makeMove(move.move);
            }
        }
        // don't animate the last move
        cube.animationForceEnd();

        // redo the last camera change (if any)
        let x = 0, y = 0, z = 0;
        let cameraChanged = false;
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart < newTime) {
                cameraChanged = true;
                x = cameraChange.x;
                y = cameraChange.y;
                z = cameraChange.z;
            }
        }
        if (cameraChanged) {
            cube.cameraUpdate(x, y, z);

        }
        setTime(newTime);
    }


    const increasePlaybackSpeed = () => {
        if (playbackSpeed < 3) {
            setPlaybackSpeed(speed => speed + 0.25);
        }
    }

    const decreasePlaybackSpeed = () => {
        if (playbackSpeed > 0.25) {
            setPlaybackSpeed(speed => speed - 0.25);
        }
    }

    // fetch loading
    if (loading) {
        return <div>Loading ...</div>;
    }

    // fetch error
    if (error) {
        return <div>Error ...</div>
    }

    return (
        <>
            <div style={{position: "absolute", fontSize: "30px", margin: 10}}>
                <div style={{display: "flex"}}>
                    <Tooltip label="go back" color="blue">
                        <ActionIcon size="xl" radius="xl" onClick={() => navigate(-1)}><IconArrowLeft /></ActionIcon>
                    </Tooltip>
                    <Space w="sm" />
                    <Tooltip label="home" color="blue">
                        <ActionIcon size="xl" radius="xl" onClick={() => navigate("/")}><IconHome /></ActionIcon>
                    </Tooltip>
                </div>
                <Text>Use <Kbd>Space</Kbd>, <Kbd>LeftArrow</Kbd> and <Kbd>RightArrow</Kbd> to navigate the solve</Text>
                <Text size="2xl">
                    Scramble: {solve.scramble}
                </Text>
                <div>{solve.completed ? "Completed" : "Not completed"} {solve.completed ? renderTime(solve.time) : ""} </div>

            </div>
            <RenderedCube cube={cube} style={{height: "100vh"}}/>
            <div style={{position: "absolute", width: "100vw", bottom: "2vh", textAlign: "center"}}>
                <div style={{ width: "80%", margin: "0 auto"}}>
                    <div>{renderTime(time)}</div>
                    <Center>
                        <ActionIcon.Group>
                            <ActionIcon onClick={() => changeTime(-5000)}><IconRewindBackward5 /></ActionIcon>
                            <ActionIcon onClick={onPlayButtonClick}>{paused ? <IconPlayerPlay /> : <IconPlayerPause />}</ActionIcon>
                            <ActionIcon onClick={() => changeTime(5000)}><IconRewindForward5 /></ActionIcon>
                        </ActionIcon.Group>
                    </Center>
                    <Slider
                        min={0}
                        max={solve.time}
                        value={time}
                        label={renderTime}
                        onChange={manualTimeChange}
                    ></Slider>
                    <Flex align="center" justify="center">
                        <ActionIcon onClick={decreasePlaybackSpeed}><IconMinus /></ActionIcon>
                        <Space w="sm"></Space>
                        <Text>
                        { (playbackSpeed).toFixed(2) }x
                        </Text>
                        <Space w="sm"></Space>
                        <ActionIcon onClick={increasePlaybackSpeed}><IconPlus /></ActionIcon>
                        <ActionIcon onClick={() => setPlaybackSpeed(1)}><IconReload /></ActionIcon>
                    </Flex>
                </div>
            </div>
        </>
    )
}