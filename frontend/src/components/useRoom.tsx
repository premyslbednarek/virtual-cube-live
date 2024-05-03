import { useEffect, useMemo, useState } from "react";
import Cube from "../cube/cube";
import useStopwatch from "./useTimer";
import useCountdown from "./useCountdown";
import { print_time } from "../cube/timer";

const INSPECTION_LENGTH = 3 // solve inspection length in seconds

function print_solve_time(time: number | null) {
    if (!time) {
        return "DNF";
    }
    return print_time(time);
}


export default function useTimedCube() {
    const cube = useMemo(() => new Cube(3), []);

    const stopwatch = useStopwatch()
    const countdown = useCountdown()

    const [isSolving, setIsSolving] = useState(false);

    const [times, setTimes] = useState<Array<number | null>>([])

    // init cube controls
    useEffect(() => {
        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();

        const onMouseDown = (event: MouseEvent) => {
            cube.mouseDown(event);
        }
        const onMouseUp = (event: MouseEvent) => {
            cube.mouseUp(event);
        }
        const onResize = () => {
            cube.resizeCanvas();
        }

        window.addEventListener("resize", onResize);
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("resize", onResize);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
            cube.remove_keyboard_controls();
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
        stopwatch
    }
}