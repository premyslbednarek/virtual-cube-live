import { useEffect, useMemo, useState } from "react";
import Cube from "../cube/cube";
import { ControlledCube } from "./CubeCanvases";
import NavigationPanel from "./NavigationPanel";
import { socket } from "../socket";
import * as THREE from 'three';
import { ActionIcon, Button, Slider, Text, Modal } from "@mantine/core";
import { useHotkeys } from "react-hotkeys-hook";
import useCountdown from "./useCountdown";
import useStopwatch from "./useTimer";
import { parse_move } from "../cube/move";
import { print_time } from "../cube/timer";
import { IconDeviceFloppy } from "@tabler/icons-react";
import ShowSolvesToContinue from "./ShowSolvesToContinue";
import { useDisclosure } from "@mantine/hooks";
import TimeHistory, { Solve } from "./TimeHistory";

const default_cube_size = 3;

export default function SoloMode() {

    const [cubeSize, setCubeSize] = useState(default_cube_size);

    const cube = useMemo(() => new Cube(default_cube_size), []);
    const [inSolve, setInSolve] = useState(false);
    const [lastTime, setLastTime] = useState<number | null>(null);
    const [times, setTimes] = useState<Array<Solve>>([]);

    const timer = useStopwatch();
    const {
        secondsLeft: inspectionSecondsLeft,
        start: startCountdown,
        isRunning: inspectionRunning
    } = useCountdown();

    const [opened, { open, close }] = useDisclosure(false);


    const onComplete = ({time, solve_id} : {time: number, solve_id: number}) => {
        timer.stop();
        setLastTime(time);
        setTimes([{time: time, id: solve_id, completed: true}, ...times]);
        setInSolve(false);
        console.log("finished");
    }

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();

        socket.emit("solo_join", {cubeSize: cubeSize})


        function send_move(move_str: string) {
            const data = {
                move: move_str
            }
            socket.emit("lobby_move", data);
        }

        function send_camera(new_position: THREE.Vector3) {
            const data = {
                position: new_position
            }
            socket.emit("lobby_camera", data);
        }

        cube.onMove(send_move);
        cube.onCamera(send_camera);

        return () => {
            cube.remove_keyboard_controls();
            console.log("disconnection from socket...")
            socket.disconnect();
        };
        // eslint-disable-next-line
    }, [])

    useEffect(() => {
        socket.on("your_solve_completed", onComplete)
        return () => {
            socket.off("your_solve_completed", onComplete)
        }
    })


    const startSolve = async () => {
        setInSolve(true);
        setLastTime(null);
        console.log("start")
        const data: {state: string} = await socket.emitWithAck("solo_solve_start");

        cube.setState(data.state);
        cube.startInspection();

        startCountdown(3, () => {
            timer.start();
            cube.startSolve();
        })
    }

    useHotkeys("space", startSolve, {enabled: !inSolve})

    const solveTheCube = async () => {
        const data : {moves_done: Array<string>} = await socket.emitWithAck("get_solution")
        for (let i = data.moves_done.length - 1; i >= 0; --i) {
            const moveObj = parse_move(data.moves_done[i]);
            moveObj.reverse();
            cube.makeMove(moveObj.toString());
            await new Promise(r => setTimeout(r, 200));
        }
    }

    useHotkeys("ctrl+1", solveTheCube, {enabled: inSolve});

    const displayTime = <div style={{
        textAlign: "center",
        fontSize: "40px",
        lineHeight: "40px",
        padding: 0,
    }}>
        { inspectionRunning && <div>{inspectionSecondsLeft}</div> }
        { !inspectionRunning && inSolve && lastTime == null && timer.formattedTime }
        { !inspectionRunning && lastTime != null && print_time(lastTime)}
        {/* { !inspectionRunning && !inSolve && !beforeFirstSolve && solveTime == null && "DNF"} */}
    </div>

    const save = () => {
        socket.emit(
            "save_solve"
        )
        cube.setState(cube.getDefaultState());
        setInSolve(false);
        timer.stop();
    }

    const continue_solve = async (solve_id: number) => {
        const response: {startTime: number, state: string, layers: number} = await socket.emitWithAck("continue_solve", {solve_id: solve_id});
        setInSolve(true);
        cube.changeLayers(response.layers)
        cube.setState(response.state)
        setCubeSize(response.layers);
        setLastTime(null);
        timer.startFromTime(response.startTime);
        close();
    }

    const onLayersChange = (newSize: number) => {
        setCubeSize(newSize);
        socket.emit("change_layers", {newSize: newSize});
        cube.changeLayers(newSize);
        setTimes([]);
    }

    return (
        <>
            <Modal opened={opened} onClose={close} title="Pick a solve to continue">
                <ShowSolvesToContinue onContinue={continue_solve} />
            </Modal>
            <div style={{position: "absolute"}}>
                <NavigationPanel />
                <Text>Cube size: {cubeSize}</Text>
                <Slider
                    value={cubeSize}
                    onChange={onLayersChange}
                    min={2}
                    max={7}
                ></Slider>
                { inSolve && <ActionIcon onClick={save}><IconDeviceFloppy></IconDeviceFloppy></ActionIcon>}
                { !inSolve && <Button onClick={open}>Continue solve</Button>}
            </div>
            <div style={{height: "100vh"}}>
                <ControlledCube cube={cube} />
            </div>
            <div style={{position: "absolute", bottom: 20, margin: "auto", width: "100%", textAlign: "center"}}>
                {displayTime}
                { !inSolve && <Button onClick={startSolve}>Start solve [spacebar]</Button> }
                <div>
                {/* { !inSolve && lastTime && print_time(lastTime)} */}
                {/* { inSolve && !inspectionRunning && formattedTime } */}
                </div>
                <div>
                {/* { inSolve && inspectionRunning && inspectionSecondsLeft } */}
                </div>
            </div>
            {
                !inSolve &&
                <div style={{position: "absolute", bottom: 0}}>
                    <TimeHistory cubeSize={cubeSize} />
                </div>
            }
        </>
    );
}