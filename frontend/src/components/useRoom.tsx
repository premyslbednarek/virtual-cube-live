import { useMemo, useState } from "react";
import Cube from "../cube/cube";
import useStopwatch from "./useTimer";
import useCountdown from "./useCountdown";

export type RoomInfo = {
    inSolve: boolean;
    lastTime: number | null;
    beforeFirstSolve: boolean;
    stopwatch: ReturnType<typeof useStopwatch>;
    countdown: ReturnType<typeof useCountdown>;
}

export default function useRoom() {
    const cube = useMemo(() => new Cube(3), []);

    const stopwatch = useStopwatch()
    const countdown = useCountdown()

    const [isSolving, setIsSolving] = useState(false);

    const [times, setTimes] = useState<number[]>([])
}