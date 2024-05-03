import { useEffect, useState } from "react";
import { print_time } from "../cube/timer";

export function useCountdown() {
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [onEndCallback, setOnEndCallback] = useState<(() => void) | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (isRunning) {
            const interval = setInterval(() => {
                setSecondsLeft(seconds => seconds - 1);
            }, 1000)
            return () => {
                clearInterval(interval);
            }
        }
    }, [isRunning])

    useEffect(() => {
        if (secondsLeft === 0 && isRunning) {
            onEndCallback && onEndCallback();
            setIsRunning(false);
        }
    }, [secondsLeft, onEndCallback, isRunning])

    const start = (seconds: number, callback: () => void) => {
        setSecondsLeft(seconds);
        // avoid calling the function on assigment
        // react thinks we want to use setState(oldState => oldState + 1)
        // when passing a function as a new value
        // https://stackoverflow.com/a/58458899
        setOnEndCallback(() => callback);
        setIsRunning(true);
    }

    const stop = () => {
        setIsRunning(false);
    }

    return { secondsLeft, start, isRunning, stop };
}

export function useStopwatch() {
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