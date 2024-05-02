import { useEffect, useState } from "react";
import { print_time } from "../cube/timer";

export default function useStopwatch() {
    // time in milliseconds
    const [time, setTime] = useState(0);
    const formattedTime = print_time(time);
    const [isRunning, setIsRunning] = useState(false);

    // update the timer every x ms
    const update_interval = 51;

    // if the timer is not paused, update it
    useEffect(() => {
        if (isRunning) {
            const interval = setInterval(() => {
                setTime(time => time + update_interval)
            }, update_interval);
            return () => {
                clearInterval(interval);
            }
        }
    }, [isRunning])

    const start = () => {
        setTime(0);
        setIsRunning(true);
    }

    const startFromTime = (time: number) => {
        setTime(time);
        setIsRunning(true)
    }

    const stop = () => {
        setIsRunning(false);
    }

    return { time, formattedTime, start, stop, startFromTime, isRunning };
}