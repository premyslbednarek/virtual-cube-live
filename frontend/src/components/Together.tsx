import { useLocation, useNavigate, useParams } from "react-router-dom";
import ErrorPage from "./ErrorPage";
import { useContext, useEffect, useMemo, useState } from "react";
import { socket } from "../socket";
import Cube from "../cube/cube";
import { ControlledCube } from "./CubeCanvases";
import { UserContext } from "../userContext";
import * as THREE from 'three';
import { Button } from "@mantine/core";
import CopyButton from "../CopyButton";

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

    const cube = useMemo(() => new Cube(3), []);

    useEffect(() => {
        socket.connect();

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();
        cube.defaultMake = false;

        cube.onMove((move_str: string) => socket.emit("together_move", { move: move_str }));
        cube.onCamera((new_position: THREE.Vector3) => socket.emit("together_camera", { position: new_position }));

        socket.emit(
            "together_join",
            { "id": id },
            (response: TogetherJoinResponse) => {
                setUsers(response.users);
                cube.changeLayers(response.cube_size);
                cube.setState(response.cube_state);
                setUuid(response.uuid)
            }
        )

        return () => {
            cube.remove_keyboard_controls();
            socket.disconnect();
        }
    }, [])

    const onJoin = ({username: newUser} : {username: string}) => {
        setUsers([...users, newUser]);
    }

    const onDc = ({username: oldUserUsername} : {username: string}) => {
        setUsers(users.filter(username => username != oldUserUsername));
    }

    const onMove = ({move, username} : {move: string, username: string}) => {
        cube.makeMove(move, false, true);
    }

    const onCamera = ({position, username} : {position: THREE.Vector3, username: string}) => {
        cube.updateCamera(position);
    }

    const onSetState = ({state} : {state: string}) => {
        cube.setState(state);
    }

    useEffect(() => {
        socket.on("together_join", onJoin);
        socket.on("together_dc", onDc);
        socket.on("together_move", onMove);
        socket.on("together_camera", onCamera);
        socket.on("together_set_state", onSetState);
        return () => {
            socket.off("together_join", onJoin);
            socket.off("together_dc", onDc);
            socket.off("together_move", onMove);
            socket.off("together_camera", onCamera);
            socket.off("together_set_state", onSetState);
        }
    })

    const inviteURL = window.location.host + "/together/" + uuid;
    return (
        <>
            <div style={{position: "absolute"}}>
                <div>
                    <Button onClick={() => socket.emit("together_reset")}>Reset cube</Button>
                </div>
                <div>
                    {inviteURL}
                    <CopyButton value={inviteURL}></CopyButton>
                </div>
                <div>
                    Users in the lobby:
                    { users.map(user => (
                        <div key={user}>{user} {userContext.username == user && " (you)"}</div>
                    ))}
                </div>
            </div>
            <div style={{height: "100vh"}}>
                <ControlledCube cube={cube} />
            </div>
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