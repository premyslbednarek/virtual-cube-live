import { useEffect, useState } from "react";
import CubeCanvas from "../components/CubeCanvas";
import { NavigationIcons } from "../components/NavigationButtons";
import { socket } from "../socket";
import { Button, Modal, Space, Center, Tooltip, Flex } from "@mantine/core";
import { useHotkeys } from "react-hotkeys-hook";
import { IconDeviceFloppy } from "@tabler/icons-react";
import ContinuableSolvesButton from "../components/ContinuableSolvesButton";
import { useDisclosure } from "@mantine/hooks";
import SidePanelTimeList from "../components/SidePanelTimeList";
import useCube, { DEFAULT_CUBE_SIZE } from "../hooks/useCube";
import { CubeSizeController } from "../components/CubeSizeController";
import { useSpeedMode } from "../hooks/useSpeedMode";
import TimerDisplay from "../components/TimerDisplay";
import { Overlay } from "../components/Overlay";
import KeybindsButton from "../components/KeybindsButton";

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

    } = useCube()

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

    const save = () => {
        socket.emit(
            "save_solve"
        )
        cube.reset();
        setIsSolving(false);
        stopwatch.stop();
    }

    const continueSolve = async (solve_id: number) => {
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
            <SidePanelTimeList cubeSize={cubeSize} continueFn={continueSolve}/>
        </>
    )

    return (
        <>
            <Modal opened={opened} onClose={close} title="Pick a solve to continue">
                <ContinuableSolvesButton onContinue={continueSolve} />
            </Modal>

            <Overlay position="left">
                <Flex align="center">
                    <NavigationIcons />
                    <KeybindsButton />
                </Flex>

                {panelContent}

            </Overlay>

            <CubeCanvas cube={cube} fullscreen />

            <Overlay position="bottom">
                <TimerDisplay time={timeString} />
                <Center>
                    { !isSolving && <Button onClick={startSolve}>Start solve [spacebar]</Button> }
                </Center>
            </Overlay>
        </>
    );
}