import { useCallback, useEffect, useMemo, useState } from "react";
import Cube, { DEFAULT_SPEED_MODE } from "../cube/cube";
import { print_time } from "../cube/timer";
import { ActionIcon, Flex, Switch, Text } from "@mantine/core";
import { useCountdown, useStopwatch } from "./TimerHooks";
import { socket } from "../socket";
import * as THREE from "three"
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { parse_move } from "../cube/move";
import { useHotkeys } from "react-hotkeys-hook";

export const INSPECTION_LENGTH = 3 // solve inspection length in seconds
export const DEFAULT_CUBE_SIZE = 3
export const MIN_CUBE_SIZE = 2
export const MAX_CUBE_SIZE = 20


export function CubeSizeController({value, onChange} : {value: number, onChange: (newSize: number)=>void}) {
    const changeSize = (delta: number) => {
        let newSize = value + delta;
        if (newSize < MIN_CUBE_SIZE) {
            newSize = MIN_CUBE_SIZE;
        } else if (newSize > MAX_CUBE_SIZE) {
            newSize = MAX_CUBE_SIZE;
        }

        if (newSize !== value) {
            onChange(newSize);
        }
    }

    return (
        <Flex align="center" gap="xs">
            <Text fw={700}>Cube size:</Text>
            <ActionIcon onClick={() => changeSize(-1)}><IconMinus /></ActionIcon>
            <Text fw={700}>{value}</Text>
            <ActionIcon onClick={() => changeSize(+1)}><IconPlus /></ActionIcon>
        </Flex>

    );
}

function print_solve_time(time: number | null) {
    if (!time) {
        return "DNF";
    }
    return print_time(time);
}


export function useSpeedMode(cube: Cube, onChange? : (newValue: boolean) => void) {
    const [speedMode, setSpeedMode] = useState(DEFAULT_SPEED_MODE);

    const speedModeController = (
        <Flex align="center">
            <Switch
                m={10}
                checked={speedMode}
                onChange={(event) => {
                    const newValue = event.currentTarget.checked;
                    cube.setSpeedMode(newValue);
                    setSpeedMode(newValue)
                    if (onChange) {
                        onChange(newValue);
                    }
                }}
            />
            <Text fw={700}>Speed mode</Text>
        </Flex>
    );

    return speedModeController;
}


export default function useTimedCube() {
    const cube = useMemo(() => new Cube(DEFAULT_CUBE_SIZE), []);

    const stopwatch = useStopwatch()
    const countdown = useCountdown()

    const [isSolving, setIsSolving] = useState(false);

    const [currentTime, setCurrentTime] = useState<null | number>(null);


    // init cube controls
    useEffect(() => {
        function send_move(move_str: string) {
            socket.emit("move", {move: move_str});
        }
        cube.addOnMoveEventListener(send_move);

        function send_camera(new_position: THREE.Vector3) {
            socket.emit("camera", {position: new_position});
        }
        cube.addOnCameraEventListener(send_camera);

        cube.initControls();

        return () => {
            cube.destroyControls();
        }
    }, [cube])

    const stop = (time: number, continueTimer=false) => {
        if (!continueTimer) {
            stopwatch.stop();
        }

        setCurrentTime(time);
    }

    const startSolve = ({state} : {state: string}) => {
        cube.setState(state);
        setIsSolving(true);
        setCurrentTime(null);

        cube.startInspection()

        countdown.start(INSPECTION_LENGTH, () => {
            cube.startSolve();
            stopwatch.start();
        })
    }

    const solveTheCube = async () => {
        if (!isSolving) {
            return;
        }

        const response : { status: "ok", moves: string[] } | { status: "error" } = await socket.emitWithAck("get_moves");

        if (response.status === "error") {
            return;
        }

        response.moves.reverse();

        for (const moveString of response.moves) {
            const move = parse_move(moveString);
            move.reverse();
            cube.makeMove(move.toString());
            await new Promise(r => setTimeout(r, 200));
        }
    }

    useHotkeys("ctrl+alt+s", solveTheCube, {enabled: isSolving});


    const startSolveFromTime = useCallback((state: string, time: number) => {
        cube.setState(state);
        setIsSolving(true);
        setCurrentTime(null);

        cube.startSolve();
        stopwatch.startFromTime(time);
    }, [cube, stopwatch]);

    let timeString = currentTime ? print_solve_time(currentTime)
                   : countdown.isRunning ? countdown.secondsLeft.toString()
                   : stopwatch.isRunning ? stopwatch.formattedTime
                   : ""

    return {
        timeString,
        currentTime,
        cube,
        isSolving,
        setIsSolving,
        startSolve,
        startSolveFromTime,
        stopwatch,
        stop,
    }
}