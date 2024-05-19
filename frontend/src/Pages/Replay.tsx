import { useEffect, useState, useMemo, useContext } from "react";
import { useParams } from "react-router-dom"
import CubeCanvas from "../components/CubeCanvas";
import { Text, Space, Slider, ActionIcon, Center, Flex, Kbd, Container, Stack, Checkbox, Alert, Popover, Button } from "@mantine/core";
import Cube from "../cube/cube";
import { useHotkeys } from "react-hotkeys-hook";
import {IconPlayerPlay, IconPlayerPause, IconRewindBackward5, IconRewindForward5, IconPlus, IconMinus, IconReload} from "@tabler/icons-react"
import { NavigationIcons } from "../components/NavigationButtons";
import { print_time } from "../cube/timer";
import CopyButton from "../components/CopyButton";
import { useSpeedMode } from "../hooks/useSpeedMode";
import { AuthContext } from "../authContext";
import { DeleteSolveButton } from "../components/DeleteSolveButton";
import { produce } from "immer";

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
    id: number,
    cube_size: number;
    scramble: string;
    scramble_state: string;
    moves: Array<IMoveInfo>;
    camera_changes: Array<ICameraInfo>;
    completed: boolean;
    time: number;
    banned: boolean;
    deleted: boolean;
}

const defaultSolveInfo: ISolveInfo = {
    id: 0,
    cube_size: 3,
    scramble: "",
    scramble_state: "",
    moves: [],
    camera_changes: [],
    completed: false,
    time: 0,
    banned: false,
    deleted: false,
}


const UPDATE_INTERVAL = 17; // in ms

export function ReplayPage() {
    const { solveId } = useParams();
    if ( !solveId ) {
        return null;
    }

    return (
        <>
            <div style={{position: "absolute", fontSize: "30px", margin: 10, zIndex: 5}}>
                <NavigationIcons />
            </div>
            <div style={{height: "100vh", width: "100vw"}}>
                <Replay solveId={solveId} />
            </div>
        </>
    );

}

export function Replay({solveId} : {solveId : string}) {
    const [time, setTime] = useState(0); // current time in ms
    const [paused, setPaused] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    const [solve, setSolve] = useState(defaultSolveInfo);
    const { authInfo } = useContext(AuthContext);

    useEffect(() => {
        fetch(`/api/solve/${solveId}`).then(res => res.json()).then((solve: ISolveInfo) => {
            for (const move of solve.moves) {
                move.sinceStart = Math.floor(move.sinceStart);
            }
            solve.moves.sort((a, b) => a.sinceStart - b.sinceStart);
            if (solve.moves.length) {
                solve.moves[solve.moves.length - 1].sinceStart -= 1;
            }
            setSolve(solve);
            setPaused(false);
        })
    }, [solveId])

    const [manualCamera, setManualCamera] = useState(true);
    const setFollowReplayCamera = (newVal: boolean) => {
        cube.orbitCamera.enabled = newVal;
        setManualCamera(newVal);
    }

    const cube = useMemo(() => {
        const cube = new Cube(solve.cube_size);
        cube.setState(solve.scramble_state);
        return cube;
    }, [solve])
    cube.orbitCamera.enabled = manualCamera;

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
            setTime(solve.time);
        }
    }, [time, solve.time])

    // apply moves/camera changes that happen until next time change
    useEffect(() => {
        for (const move of solve.moves) {
            if (move.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= move.sinceStart && move.sinceStart < time + UPDATE_INTERVAL * playbackSpeed) {
                cube.makeMove(move.move);
            }
        }
        if (manualCamera) return;
        for (const cameraChange of solve.camera_changes) {
            if (cameraChange.sinceStart > time + UPDATE_INTERVAL * playbackSpeed) break;
            if (time <= cameraChange.sinceStart && cameraChange.sinceStart < time + UPDATE_INTERVAL * playbackSpeed) {
                cube.cameraUpdate(cameraChange.x, cameraChange.y, cameraChange.z)
            }
        }

    }, [time, playbackSpeed, cube, solve, manualCamera]);

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
            manualTimeChange(time);
        }
    }

    const decreasePlaybackSpeed = () => {
        if (playbackSpeed > 0.25) {
            setPlaybackSpeed(speed => speed - 0.25);
            manualTimeChange(time);
        }
    }

    const onDeletion = (id: number, newVal: boolean) => {
        setSolve(produce(draft => {
            draft.deleted = newVal;
            return draft;
        }))
    }

    return (
        <>
            <div style={{position: "absolute", width: "100%"}}>
                <Container mt={10}>
                    <Center>
                        <Stack gap="sm">
                            { solve.banned && <Alert color="red" ta="center">This user has been banned.</Alert>}
                            { solve.deleted && <Alert color="red" ta="center">This solve has been deleted.</Alert>}
                            { authInfo.isAdmin && <DeleteSolveButton deleted={solve.deleted} solve_id={solve.id} onChange={onDeletion} /> }


                            <Text ta="center">Use <Kbd>Space</Kbd>, <Kbd>LeftArrow</Kbd> and <Kbd>RightArrow</Kbd> to navigate the solve</Text>
                            <Popover width="30%">
                                <Popover.Target>
                                    <Button size="sm">Show scramble</Button>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Text ta="center">Scramble: {solve.scramble}</Text>
                                    <Flex justify="center">
                                        <CopyButton value={solve.scramble} />
                                    </Flex>
                                </Popover.Dropdown>
                            </Popover>

                            <Text ta="center" size="xl">Time: {solve.completed ? print_time(solve.time) : "DNF"}</Text>
                        </Stack>
                    </Center>
                </Container>
            </div>
            <div style={{width: "100%", height: "100%", zIndex: -1}}>
                <CubeCanvas cube={cube} />
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