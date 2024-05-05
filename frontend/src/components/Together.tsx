import { useLocation, useNavigate, useParams } from "react-router-dom";
import ErrorPage from "./ErrorPage";
import { useContext, useEffect, useState } from "react";
import { socket } from "../socket";
import { UserContext } from "../userContext";
import * as THREE from 'three';
import { Text, Button, Center, Flex, Title } from "@mantine/core";
import CopyButton from "../CopyButton";
import useTimedCube, { CubeSizeController, DEFAULT_CUBE_SIZE, useSpeedMode } from "./useTimedCube";
import { RenderedCube } from "./CubeCanvases";
import { Overlay } from "./Overlay";
import TimerDisplay from "./TimerDisplay";
import NavigationPanel from "./NavigationPanel";
import KeybindsButton from "./ShowKeybindigs";

interface TogetherJoinResponse {
    users: string[];
    cube_size: number;
    cube_state: string;
    uuid: string;
}

function TogetherLobby({id} : {id: number}) {
    const [users, setUsers] = useState<string[]>([]);
    const [uuid, setUuid] = useState<string | null>(null);
    const { userContext } = useContext(UserContext)

    const [cubeSize, setCubeSize] = useState(DEFAULT_CUBE_SIZE);
    const { cube, setIsSolving, addTime, startSolve, stopwatch, timeString } = useTimedCube()
    const speedModeController = useSpeedMode(cube);

    useEffect(() => {
        socket.connect();

        cube.defaultPerformMove = false;

        socket.emit(
            "together_join",
            { "id": id },
            (response: TogetherJoinResponse) => {
                setUsers(response.users);
                cube.setSize(response.cube_size);
                cube.setState(response.cube_state);
                setUuid(response.uuid)
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
        if (username !== userContext.username) {
            cube.updateCamera(position);
        }
    }

    const onSetState = ({state} : {state: string}) => {
        cube.setState(state);
    }

    const onSolveEnd = ({time} : {time: number}) => {
        stopwatch.stop()
        setIsSolving(false);
        addTime(time);
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

    const inviteURL = window.location.host + "/together/" + uuid;
    return (
        <>
            <Overlay position="top">
                <Center>
                    {inviteURL} <CopyButton value={inviteURL}></CopyButton>
                </Center>
            </Overlay>
            <Overlay position="left">
                <Flex align="center">
                    <NavigationPanel />
                    <KeybindsButton />
                </Flex>
                {speedModeController}
                <CubeSizeController value={cubeSize} onChange={changeCubeSize} />
                <Title order={3}>Users in the lobby:</Title>
                { users.map(user => (
                    <Text key={user}>{user} {userContext.username === user && " (you)"}</Text>
                ))}
            </Overlay>

            <RenderedCube cube={cube} fullscreen />

            <Overlay position="bottom">
                <TimerDisplay time={timeString} />
                <Flex justify="center" gap="md">
                    <Button onClick={() => socket.emit("together_reset")}>Reset cube</Button>
                    <Button onClick={() => socket.emit("together_solve_start")}>Solve start</Button>
                </Flex>

            </Overlay>
        </>
    );
}

export function TogetherJoin() {
    const params = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        fetch("/api/get_together_id", {
            method: "POST",
            body: JSON.stringify({uuid: params.uuid})
        }).then(res => res.json()).then((data : {id: number}) => {
            navigate("/together", {state: {id: data.id}})
        }).catch(err => console.log(err));
    })

    return null;
}

export default function Together() {
    const location = useLocation();

    if (!location.state || !location.state.id) {
        return <ErrorPage message="Together lobby id not specified" />
    }

    const lobby_id: number = location.state.id;

    return <TogetherLobby id={lobby_id} />
}