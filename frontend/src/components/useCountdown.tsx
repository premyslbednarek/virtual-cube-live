import { useEffect, useState } from "react";

export default function useCountdown() {
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

    const startCountdown = (seconds: number, callback: () => void) => {
        setSecondsLeft(seconds);
        // avoid calling the function on assigment
        // react thinks we want to use setState(oldState => oldState + 1)
        // when passing a function as a new value
        // https://stackoverflow.com/a/58458899
        setOnEndCallback(() => callback);
        setIsRunning(true);
    }

    return { secondsLeft, startCountdown, isRunning };
}