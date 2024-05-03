import { useEffect, useState } from "react";
import { RenderedCube } from "./CubeCanvases";
import NavigationPanel from "./NavigationPanel";
import { socket } from "../socket";
import * as THREE from 'three';
import { Flex, ActionIcon, Button, Slider, Text, Modal, Space, Center } from "@mantine/core";
import { useHotkeys } from "react-hotkeys-hook";
import { parse_move } from "../cube/move";
import { IconDeviceFloppy } from "@tabler/icons-react";
import ShowSolvesToContinue from "./ShowSolvesToContinue";
import { useDisclosure } from "@mantine/hooks";
import TimeHistory, { Solve } from "./TimeHistory";
import useTimedCube from "./useRoom";
import TimerDisplay from "./TimerDisplay";
import { Panel } from "./Panels";

const default_cube_size = 3;

export default function SoloMode() {
    const [cubeSize, setCubeSize] = useState(default_cube_size);

    const {
        timeString,
        cube,
        isSolving,
        setIsSolving,
        addTime,
        startSolve: startSolve_,
        stopwatch
    } = useTimedCube()

    const [times, setTimes] = useState<Array<Solve>>([]);

    const [opened, { open, close }] = useDisclosure(false);

    const onComplete = ({time, solve_id} : {time: number, solve_id: number}) => {
        stopwatch.stop();
        addTime(time);
        setTimes([{time: time, id: solve_id, completed: true}, ...times]);
        setIsSolving(false);
        console.log("finished");
    }

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

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
            console.log("disconnection from socket...")
            socket.disconnect();
        };
    }, [cube, cubeSize])

    useEffect(() => {
        socket.on("your_solve_completed", onComplete)
        return () => {
            socket.off("your_solve_completed", onComplete)
        }
    })


    const startSolve = async () => {
        const data: {state: string} = await socket.emitWithAck("solo_solve_start");
        startSolve_(data);
    }

    useHotkeys("space", startSolve, {enabled: !isSolving})

    const solveTheCube = async () => {
        const data : {moves_done: Array<string>} = await socket.emitWithAck("get_solution")
        for (let i = data.moves_done.length - 1; i >= 0; --i) {
            const moveObj = parse_move(data.moves_done[i]);
            moveObj.reverse();
            cube.makeMove(moveObj.toString());
            await new Promise(r => setTimeout(r, 200));
        }
    }

    useHotkeys("ctrl+1", solveTheCube, {enabled: isSolving});

    const save = () => {
        socket.emit(
            "save_solve"
        )
        cube.setState(cube.getDefaultState());
        setIsSolving(false);
        stopwatch.stop();
    }

    const continue_solve = async (solve_id: number) => {
        const response: {startTime: number, state: string, layers: number} = await socket.emitWithAck("continue_solve", {solve_id: solve_id});
        setIsSolving(true);
        cube.changeLayers(response.layers)
        cube.setState(response.state)
        setCubeSize(response.layers);
        stopwatch.startFromTime(response.startTime);
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

            <Panel position="left">
                <Flex align="center">
                    <NavigationPanel />
                    { !isSolving && <Button onClick={open} size="md" radius="md">Continue solve</Button>}
                </Flex>
                <Text>Cube size: {cubeSize}</Text>
                <Slider
                    value={cubeSize}
                    onChange={onLayersChange}
                    min={2}
                    max={7}
                ></Slider>
                { isSolving && <ActionIcon onClick={save}><IconDeviceFloppy></IconDeviceFloppy></ActionIcon>}
                <Space h="sm"></Space>
                { !isSolving && <TimeHistory cubeSize={cubeSize} /> }
            </Panel>

            <RenderedCube cube={cube} fullscreen />

            <Panel position="bottom">
                <TimerDisplay time={timeString} />
                <Center>
                    { !isSolving && <Button onClick={startSolve}>Start solve [spacebar]</Button> }
                </Center>
            </Panel>
        </>
    );
}