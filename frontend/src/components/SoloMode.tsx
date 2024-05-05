import { useEffect, useState } from "react";
import { RenderedCube } from "./CubeCanvases";
import NavigationPanel from "./NavigationPanel";
import { socket } from "../socket";
import { Button, Modal, Space, Center, Tooltip, Flex } from "@mantine/core";
import { useHotkeys } from "react-hotkeys-hook";
import { parse_move } from "../cube/move";
import { IconDeviceFloppy } from "@tabler/icons-react";
import ShowSolvesToContinue from "./ShowSolvesToContinue";
import { useDisclosure } from "@mantine/hooks";
import TimeHistory from "./TimeHistory";
import useTimedCube, { CubeSizeController, DEFAULT_CUBE_SIZE, useSpeedMode } from "./useTimedCube";
import TimerDisplay from "./TimerDisplay";
import { Overlay } from "./Overlay";
import KeybindsButton from "./ShowKeybindigs";

export default function SoloMode() {
    const [cubeSize, setCubeSize] = useState(DEFAULT_CUBE_SIZE);

    const {
        timeString,
        cube,
        isSolving,
        setIsSolving,
        stop,
        startSolve: startSolve_,
        startSolveFromTime,
        stopwatch,

    } = useTimedCube()

    const speedModeController = useSpeedMode(cube);

    const [opened, { open, close }] = useDisclosure(false);

    const onComplete = ({time} : {time: number, solve_id: number}) => {
        stopwatch.stop();
        stop(time);
        setIsSolving(false);
    }

    useEffect(() => {
        socket.connect();

        socket.emit("solo_join")

        return () => {
            socket.disconnect();
        };
    }, [cube])

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

    useHotkeys("space", startSolve, {enabled: !isSolving })

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
        cube.reset();
        setIsSolving(false);
        stopwatch.stop();
    }

    const continue_solve = async (solve_id: number) => {
        const response: {startTime: number, state: string, layers: number} = await socket.emitWithAck("continue_solve", {solve_id: solve_id});
        setIsSolving(true);

        cube.setSize(response.layers);
        startSolveFromTime(response.state, response.startTime);

        close();
    }

    const onLayersChange = (newSize: number) => {
        setCubeSize(newSize);
        socket.emit("change_layers", {newSize: newSize});
        cube.setSize(newSize);
    }

    const saveButton = isSolving ? (
        <Tooltip label="save current solve and continue later...">
            <Button ml="xs" mt="xs" onClick={save} leftSection={<IconDeviceFloppy />}>Save solve</Button>
        </Tooltip>
    ) : null;

    const panelContent = isSolving ? (
        <>
            {speedModeController}
            {saveButton}
        </>
    ) : (
        <>
            {speedModeController}
            <CubeSizeController value={cubeSize} onChange={onLayersChange} />
            <Space h="sm" />
            <Button onClick={open} size="md" radius="md">Continue solve</Button>
            <Space h="sm" />
            <TimeHistory cubeSize={cubeSize} />
        </>
    )

    return (
        <>
            <Modal opened={opened} onClose={close} title="Pick a solve to continue">
                <ShowSolvesToContinue onContinue={continue_solve} />
            </Modal>

            <Overlay position="left">
                <Flex align="center">
                    <NavigationPanel />
                    <KeybindsButton />
                </Flex>

                {panelContent}

            </Overlay>

            <RenderedCube cube={cube} fullscreen />

            <Overlay position="bottom">
                <TimerDisplay time={timeString} />
                <Center>
                    { !isSolving && <Button onClick={startSolve}>Start solve [spacebar]</Button> }
                </Center>
            </Overlay>
        </>
    );
}