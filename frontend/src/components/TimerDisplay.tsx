import { print_time } from "../cube/timer";
import { RoomInfo } from "./Together";
import useCountdown from "./useCountdown";
import useStopwatch from "./useTimer";

export default function TimerDisplay({stopwatch, countdown, lastTime, inSolve, beforeFirstSolve} : RoomInfo) {
    return (
        <div style={{
            textAlign: "center",
            fontSize: "40px",
            lineHeight: "40px",
            padding: 0,
        }}>
            { countdown.isRunning && <div>{countdown.secondsLeft}</div> }
            { !countdown.isRunning && inSolve && lastTime == null && stopwatch.formattedTime }
            { !countdown.isRunning && lastTime != null && print_time(lastTime)}
            { !countdown.isRunning && !inSolve && !beforeFirstSolve && lastTime == null && "DNF"}
        </div>
    );
}