import { useEffect, useMemo, useState } from "react";
import Cube, { DEFAULT_SPEED_MODE } from "../cube/cube";
import { print_time } from "../cube/timer";
import { NumberInput, Switch } from "@mantine/core";
import keybinds from "../cube/keybindings";
import { useCountdown, useStopwatch } from "./TimerHooks";

export const INSPECTION_LENGTH = 3 // solve inspection length in seconds
export const DEFAULT_CUBE_SIZE = 3
export const MIN_CUBE_SIZE = 2
export const MAX_CUBE_SIZE = 7


export function CubeSizeController({value, onChange} : {value: number, onChange: (newSize: number)=>void}) {
    return (
        <NumberInput
            m={10}
            min={MIN_CUBE_SIZE}
            max={MAX_CUBE_SIZE}
            label="Cube size"
            value={value}
            onChange={(newValue) => {
                const val = Number(newValue)
                if (MIN_CUBE_SIZE <= val && val <= MAX_CUBE_SIZE) {
                    onChange(Number(newValue));
                }
            }}
        />
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

    const speedModeController = <Switch
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
        label="Speed mode" />

    return speedModeController;
}


export default function useTimedCube() {
    const cube = useMemo(() => new Cube(DEFAULT_CUBE_SIZE), []);

    const stopwatch = useStopwatch()
    const countdown = useCountdown()

    const [isSolving, setIsSolving] = useState(false);

    const [times, setTimes] = useState<Array<number | null>>([])


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

    const addTime = (time: number) => {
        setTimes([...times, time]);
    }

    const startSolve = ({state} : {state: string}) => {
        cube.setState(state);
        setIsSolving(true);

        cube.startInspection()

        countdown.start(INSPECTION_LENGTH, () => {
            cube.startSolve();
            stopwatch.start();
        })
    }

    let timeString = countdown.isRunning ? countdown.secondsLeft.toString()
                   : stopwatch.isRunning ? stopwatch.formattedTime
                   : times.length        ? print_solve_time(times[times.length - 1])
                   : "";

    return {
        timeString,
        cube,
        isSolving,
        setIsSolving,
        addTime,
        startSolve,
        stopwatch,
    }
}