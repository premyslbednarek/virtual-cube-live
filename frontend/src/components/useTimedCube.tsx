import { useCallback, useEffect, useMemo, useState } from "react";
import Cube, { DEFAULT_SPEED_MODE } from "../cube/cube";
import { print_time } from "../cube/timer";
import { ActionIcon, Flex, Switch, Text } from "@mantine/core";
import keybinds from "../cube/keybindings";
import { useCountdown, useStopwatch } from "./TimerHooks";
import { socket } from "../socket";
import * as THREE from "three"
import { IconMinus, IconPlus } from "@tabler/icons-react";

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
        const onMouseDown = (event: MouseEvent) => {
            cube.mouseDown(event);
        }
        const onMouseUp = (event: MouseEvent) => {
            cube.mouseUp(event);
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
                return;
            }
            let move_str = keybinds.get(event.key);
            if (move_str) {
                cube.makeKeyboardMove(move_str);
            }
        }

        const onResize = () => {
            cube.resizeCanvas();
        }

        function send_move(move_str: string) {
            const data = {move: move_str}
            socket.emit("move", data);
        }

        function send_camera(new_position: THREE.Vector3) {
            const data = {position: new_position}
            socket.emit("camera", data);
        }

        cube.onMove(send_move);
        cube.onCamera(send_camera);

        window.addEventListener("resize", onResize);
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("resize", onResize);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("keydown", onKeyDown);
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