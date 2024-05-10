import { useLocation } from "react-router-dom";
import ErrorPage from "./ErrorPage";
import { useContext, useEffect, useState } from "react";
import { socket } from "../socket";
import { AuthContext } from "../authContext";
import * as THREE from 'three';
import { Text, Button, Flex, Title, Space } from "@mantine/core";
import useCube, { DEFAULT_CUBE_SIZE } from "../hooks/useCube";
import { CubeSizeController } from "../components/CubeSizeController";
import { useSpeedMode } from "../hooks/useSpeedMode";
import CubeCanvas from "../components/CubeCanvas";
import { Overlay } from "../components/Overlay";
import TimerDisplay from "../components/TimerDisplay";
import NavigationPanel from "../components/NavigationPanel";
import KeybindsButton from "../components/ShowKeybindigs";
import TimeHistory, { SolveBasic } from "../components/TimeHistory";
import Invitation from "../components/Invitation";

interface TogetherJoinResponse {
    users: string[];
    cube_size: number;
    cube_state: string;
    solveTime: number | null;
}

function TogetherLobby({id} : {id: number}) {
    const [users, setUsers] = useState<string[]>([]);
    const { authInfo } = useContext(AuthContext)

    const [cubeSize, setCubeSize] = useState(DEFAULT_CUBE_SIZE);
    const { cube, isSolving, setIsSolving, startSolve, startSolveFromTime, stop, timeString } = useCube()
    const speedModeController = useSpeedMode(cube);

    const [solves, setSolves] = useState<SolveBasic[]>([]);

    useEffect(() => {
        socket.connect();

        cube.defaultPerformMove = false;

        socket.emit(
            "together_join",
            { "id": id },
            (response: TogetherJoinResponse) => {
                setUsers(response.users);
                cube.setSize(response.cube_size);
                if (response.solveTime) {
                    startSolveFromTime(response.cube_state, response.solveTime)
                }
            }
        )

        return () => {
            socket.disconnect();
        }
    }, [cube, id])

    const onJoin = ({username: newUser} : {username: string}) => {
        setUsers([...users, newUser]);
    }

    const onDc = ({username: oldUserUsername} : {username: string}) => {
        setUsers(users.filter(username => username !== oldUserUsername));
    }

    const onMove = ({move, username} : {move: string, username: string}) => {
        cube.makeMove(move, false, true);
    }

    const onCamera = ({position, username} : {position: THREE.Vector3, username: string}) => {
        if (username !== authInfo.username) {
            cube.updateCamera(position);
        }
    }

    const onSetState = ({state} : {state: string}) => {
        cube.setState(state);
    }

    const onSolveEnd = ({time, id} : {time: number, id: number}) => {
        setSolves([{id: id, time: time, completed: true}, ...solves])
        setIsSolving(false);
        stop(time);
    }

    const onLayersChange = ({newSize} : {newSize: number}) => {
        setCubeSize(newSize);
        cube.setSize(newSize);
    }

    useEffect(() => {
        socket.on("together_join", onJoin);
        socket.on("together_dc", onDc);
        socket.on("together_move", onMove);
        socket.on("together_camera", onCamera);
        socket.on("together_set_state", onSetState);
        socket.on("together_solve_start", startSolve);
        socket.on("together_solve_end", onSolveEnd);
        socket.on("together_layers_change", onLayersChange);
        return () => {
            socket.off("together_join", onJoin);
            socket.off("together_dc", onDc);
            socket.off("together_move", onMove);
            socket.off("together_camera", onCamera);
            socket.off("together_set_state", onSetState);
            socket.off("together_solve_start", startSolve);
            socket.off("together_solve_end", onSolveEnd);
            socket.off("together_layers_change", onLayersChange);
        }
    })

    const changeCubeSize = (newSize: number) => {
        socket.emit("together_layers_change", {newSize: newSize})
    }

    return (
        <>
            <Overlay position="top">
                <Invitation id={id} type="together" show={!isSolving} />
            </Overlay>
            <Overlay position="left">
                <Flex align="center">
                    <NavigationPanel />
                    <KeybindsButton />
                </Flex>
                {speedModeController}

                <Title order={3}>Users in the lobby:</Title>
                { users.map(user => (
                    <Text key={user}>{user} {authInfo.username === user && " (you)"}</Text>
                ))}

                {
                    !isSolving && <>
                        <CubeSizeController value={cubeSize} onChange={changeCubeSize} />
                        <Space h="sm" />
                        <TimeHistory cubeSize={cubeSize} fromList={solves} />
                    </>
                }

            </Overlay>

            <CubeCanvas cube={cube} fullscreen />

            <Overlay position="bottom">
                <TimerDisplay time={timeString} />
                {
                    !isSolving &&
                        <Flex justify="center" gap="md">
                            <Button onClick={() => socket.emit("together_reset")}>Reset cube</Button>
                            <Button onClick={() => socket.emit("together_solve_start")}>Solve start</Button>
                        </Flex>
                }

            </Overlay>
        </>
    );
}

export default function Together() {
    const location = useLocation();

    if (!location.state || !location.state.id) {
        return <ErrorPage message="Together lobby id not specified" />
    }

    const lobby_id: number = location.state.id;

    return <TogetherLobby id={lobby_id} />
}