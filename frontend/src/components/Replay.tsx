import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom"
import { RenderedCube } from "./CubeCanvases";
import { Text, Space, Slider, ActionIcon, Center, Flex, Kbd, Container, Stack, Checkbox } from "@mantine/core";
import Cube from "../cube/cube";
import useFetch from "@custom-react-hooks/use-fetch";
import { useHotkeys } from "react-hotkeys-hook";
import {IconPlayerPlay, IconPlayerPause, IconRewindBackward5, IconRewindForward5, IconPlus, IconMinus, IconReload} from "@tabler/icons-react"
import NavigationPanel from "./NavigationPanel";
import { print_time } from "../cube/timer";
import CopyButton from "../CopyButton";
import { useSpeedMode } from "./useTimedCube";

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


const UPDATE_INTERVAL = 53; // in ms

export function ReplayPage() {
    const { solveId } = useParams();
    if ( !solveId ) {
        return null;
    }

    return (
        <>
            <div style={{position: "absolute", fontSize: "30px", margin: 10, zIndex: 5}}>
                <NavigationPanel />
            </div>
            <div style={{height: "100vh", width: "100vw"}}>
                <Replay solveId={solveId} />
            </div>
        </>
    );

}

export function Replay({solveId} : {solveId : string}) {
    const [time, setTime] = useState(0); // current time in ms
    const [paused, setPaused] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const { data, loading, error } = useFetch<ISolveInfo>(`/api/solve/${solveId}`);
    const solve = data ? data : defaultSolveInfo;

    const [manualCamera, setManualCamera] = useState(true);
    const setFollowReplayCamera = (newVal: boolean) => {
        cube.controls.enabled = newVal;
        setManualCamera(newVal);
    }

    useEffect(() => {
        for (const move of solve.moves) {
            move.sinceStart = Math.floor(move.sinceStart);
        }
    }, [solve])

    const cube = useMemo(() => {
        const cube = new Cube(solve.cube_size);
        cube.setState(solve.scramble_state);
        cube.controls.enabled = manualCamera;
        return cube;
    }, [solve])

    const speedModeController = useSpeedMode(cube);

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
            setPaused(true);
            // this is a hack
            setTime(solve.time);
        }
    }, [time, solve.time])

    // apply moves/camera changes that happen until next time change
    useEffect(() => {
        for (const move of solve.moves) {
            if (move.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= move.sinceStart && move.sinceStart < time + UPDATE_INTERVAL * playbackSpeed) {
                setTimeout(() => {cube.makeMove(move.move)}, (move.sinceStart - time) / playbackSpeed);
            }
        }
        if (manualCamera) return;
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= cameraChange.sinceStart && cameraChange.sinceStart < time + UPDATE_INTERVAL * playbackSpeed) {
                setTimeout(() => {cube.cameraUpdate(cameraChange.x, cameraChange.y, cameraChange.z)}, (cameraChange.sinceStart - time) / playbackSpeed);
            }
        }

    }, [time, playbackSpeed, cube, solve]);

    const onPlayButtonClick = () => {
        if (time === solve.time) {
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
        if (!manualCamera) {
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
            <div style={{position: "absolute", width: "100%"}}>
                <Container mt={10}>
                    <Center>
                        <Stack>
                            <Text ta="center">Use <Kbd>Space</Kbd>, <Kbd>LeftArrow</Kbd> and <Kbd>RightArrow</Kbd> to navigate the solve</Text>
                            <Flex align="bottom">
                                <Text ta="center" size="xl">Scramble: {solve.scramble}</Text>
                                <CopyButton value={solve.scramble} />
                            </Flex>
                            <Text ta="center" size="xl">Time: {solve.completed ? print_time(solve.time) : "DNF"}</Text>
                        </Stack>
                    </Center>
                </Container>
            </div>
            <div style={{width: "100%", height: "100%", zIndex: -1}}>
                <RenderedCube cube={cube} />
            </div>
            <div style={{position: "absolute", width: "100%", bottom: "2vh", textAlign: "center"}}>
                <div style={{ width: "80%", margin: "0 auto"}}>
                    <div>{print_time(time)}</div>
                    <div>
                        <Center>
                            <ActionIcon.Group>
                                <ActionIcon onClick={() => changeTime(-5000)}><IconRewindBackward5 /></ActionIcon>
                                <ActionIcon onClick={onPlayButtonClick}>{paused ? <IconPlayerPlay /> : <IconPlayerPause />}</ActionIcon>
                                <ActionIcon onClick={() => changeTime(5000)}><IconRewindForward5 /></ActionIcon>
                            </ActionIcon.Group>
                        </Center>
                        <div style={{position: "relative", right: 0}}>
                            <Flex align="center" justify="center">
                                <ActionIcon onClick={decreasePlaybackSpeed}><IconMinus /></ActionIcon>
                                <Space w="sm"></Space>
                                <Text>
                                { (playbackSpeed).toFixed(2) }x
                                </Text>
                                <Space w="sm"></Space>
                                <ActionIcon onClick={increasePlaybackSpeed}><IconPlus /></ActionIcon>
                                <Space w="xs"></Space>
                                <ActionIcon onClick={() => setPlaybackSpeed(1)}><IconReload /></ActionIcon>
                                {speedModeController}
                                <Space w="sm"></Space>
                                <Checkbox
                                    checked={manualCamera}
                                    onChange={event => setFollowReplayCamera(event.currentTarget.checked)}
                                />
                                <Space w="sm"></Space>
                                <Text fw={700}>Manual camera</Text>
                            </Flex>
                        </div>

                    </div>
                    <Slider
                        min={0}
                        max={solve.time}
                        value={time}
                        label={print_time(time)}
                        onChange={manualTimeChange}
                    ></Slider>
                </div>
            </div>
        </>
    )
}