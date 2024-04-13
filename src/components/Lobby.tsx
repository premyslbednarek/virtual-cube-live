import { useParams, Link } from "react-router-dom"
import React, { useRef, useEffect, useState, useMemo } from "react"
import Cube from "../cube/cube";
import {
    Grid,
    Badge,
    Button,
    Center,
    Stack,
    Space,
    Container
} from "@mantine/core"
import * as THREE from 'three';
import { socket } from "../socket";
import './lobby.css'
import { UserContext } from "../userContext";
import { useContext } from "react";
import { Timer, CountdownTimer, Timer_ } from "../cube/timer"

type Enemy = {
    cube: Cube,
    readyStatus: boolean
}

export function ControlledCube({cube, style} : {cube: Cube, style?: React.CSSProperties}) {
    useEffect(() => {
        const onMouseDown = (event: MouseEvent) => {
            cube.mouseDown(event);
        }
        const onMouseUp = (event: MouseEvent) => {
            cube.mouseUp(event);
        }

        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);

        return () => {
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
        }

    }, [cube])
    return (
        <RenderedCube cube={cube} style={style} />
    );
}

export function RenderedCube({cube, style} : {cube: Cube, style?: React.CSSProperties}) {
    const containerRef = useRef(null);

    useEffect(() => {
        console.log("Mounting")
        if (!containerRef.current) return;
        cube.mount(containerRef.current);

        const onResize = () => {
            cube.resizeCanvas();
        }

        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            if (!containerRef.current) return;
            cube.unmount(containerRef.current);
        }
    }, [cube])

    return (
        <div ref={containerRef} style={style}></div>
    );
}


function EnemyCubes({enemies}: {enemies: Map<string, Enemy>}) {
    const enemyDisplaySize = Math.min(50, 100 / enemies.size);
    return (
        <div style={{height: "100%"}}>
            { [...enemies.entries()].map(([username, enemy]) => {
                return (
                    <div key={username} style={{height: `${enemyDisplaySize}%`}}>
                        <DisplayEnemy username={username} enemy={enemy} />
                    </div>
                );
            })
            }
        </div>
    );
}


function DisplayEnemy({username, enemy} : {username: string, enemy: Enemy}) {
    const readyColor = enemy.readyStatus ? "green" : "red";
    const readyText = enemy.readyStatus ? "  READY" : "UNREADY"
    return (
        <div key={username} style={{height: "100%"}}>
            <div className="absolute">
                <Badge mt="sm" ml="sm" mr="sm">{username}</Badge>
                <Badge color={readyColor}>{readyText}</Badge>
            </div>
            <RenderedCube style={{height: "100%"}}cube={enemy.cube} />
        </div>
    );
}

function TimerDisplay({timer1, timer2} : {timer1: Timer_, timer2: Timer_}) {
    const containerRef = useRef(null);
    useEffect(() => {
        timer1.mount(containerRef.current);
        timer2.mount(containerRef.current);
    })
    return <div style={{fontSize: "40px", textAlign: "center"}} ref={containerRef}></div>
}


export default function Lobby() {
    const params = useParams();
    const lobby_id = params.lobby_id;
    const { userContext } = useContext(UserContext);

    const [ready, setReady] = useState(false);
    const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
    const [isAdmin, setIsAdmin] = useState(false);
    const [inSolve, setInSolve] = useState(false);
    const [cubeSize, setCubeSize] = useState(3);

    const cube = useMemo(() => new Cube(cubeSize), [cubeSize]);
    const timer = useMemo(() => new Timer(), []);
    const countdownTimer = useMemo(() => new CountdownTimer(), []);

    const onDisconnection = ({username} : {username: string}) => {
        console.log(username, "has left the lobby");
        console.log(enemies.delete(username));
        setEnemies(new Map(enemies));
    };

    useEffect(() => {
        cube.resizeCanvas();
        for (const enemy of enemies.values()) {
            enemy.cube.resizeCanvas();
        }
    }, [enemies]);

    const onMove = ({username, move} : {username: string, move: string}) => {
        const cube = enemies.get(username);
        if (!cube) {
            return;
        }
        cube.cube.makeMove(move);
    }

    const onCamera = (data: any) => {
        const username = data.username;
        const position = data.position;

        const cube = enemies.get(username);
        if (!cube) {
            return;
        }

        cube.cube.updateCamera(position);
    };

    const onReadyChange = ({ready_status, username} : {ready_status: boolean, username: string}) => {
        const updated = new Map(enemies);
        console.log(enemies);
        const enemy = updated.get(username);
        if (!enemy) return;
        enemy.readyStatus = ready_status;
        console.log(enemies);
        setEnemies(updated);
    }

    const onConnection = ({username} : {username: string}) => {
        console.log(username, "has joined the lobby");
        setEnemies(new Map(enemies.set(username, {cube: new Cube(cubeSize), readyStatus: false})));
    };

    type MatchStartData = {
        state: string;
        startTime: string;
    }

    const onMatchStart = ({state, startTime} : MatchStartData) => {
        console.log(state, new Date(startTime));

        for (const enemy of enemies.values()) {
            enemy.cube.setState(state);
        }

        const updatedEnemies = new Map(enemies);
        for (const enemy of updatedEnemies.values()) {
            enemy.readyStatus = false;
        }

        setInSolve(true);
        setReady(false);
        setEnemies(updatedEnemies);
        cube.setState(state);
        cube.startInspection();
        countdownTimer.start(new Date(startTime));
        countdownTimer.onTarget(() => {
            cube.startSolve();
            timer.start();
        })
    }

    const onSolved = () => {
        timer.stop();
        // setInSolve(false);
    }

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();

        interface ILobbyConnectResponse {
            code: number;
            userList: string[];
            isAdmin: boolean;
            cubeSize: number;
        }

        socket.emit("lobby_connect",
            { lobby_id: lobby_id },
            function(response: ILobbyConnectResponse) {
                if (response.code === 1) {
                    alert("You have already joined this lobby.");
                    return;
                }

                const m = new Map(enemies);
                response.userList.forEach((username: string) => {
                    m.set(username, {cube: new Cube(response.cubeSize), readyStatus: false});
                });

                setEnemies(m);
                setIsAdmin(response.isAdmin);
                setCubeSize(response.cubeSize);
            }
        )

        function send_move(move_str: string) {
            const data = {
                lobby_id: lobby_id,
                move: move_str
            }
            socket.emit("lobby_move", data);
        }

        function send_camera(new_position: THREE.Vector3) {
            const data = {
                lobby_id: lobby_id,
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
    }, [cube])

    const onReadyClick = () => {
        socket.emit(
            "lobby_ready_status",
            {lobby_id: lobby_id, ready_status: !ready}
        )
        setReady(!ready);
    }

    useEffect(() => {
        socket.on("lobby_ready_status_", onReadyChange);
        socket.on("you_solved", onSolved);
        socket.on("lobby_move", onMove);
        socket.on("lobby_camera", onCamera);
        socket.on("lobby_connection", onConnection);
        socket.on("lobby_disconnection", onDisconnection)
        socket.on("match_start", onMatchStart);
        return () => {
            socket.off("lobby_connection", onConnection);
            socket.off("you_solved", onSolved);
            socket.off("lobby_disconnection", onDisconnection)
            socket.off("lobby_ready_status_", onReadyChange);
            socket.off("lobby_move", onMove);
            socket.off("lobby_camera", onCamera);
            socket.off("match_start", onMatchStart);
        }
    })

    const readyColor = ready ? "green" : "red";
    const readyText = "YOU ARE " + (ready ? "  READY" : "UNREADY") + " (PRESS TO TOGGLE)";

    function allReady() : boolean {
        for (const enemy of enemies.values()) {
            if (!enemy.readyStatus) {
                return false;
            }
        }
        return ready;
    }

    function startLobby(force: boolean) : void {
        socket.emit(
            "lobby_start",
            { lobby_id: lobby_id, force: force }
        )
    }

    return (
        <div style={{ backgroundColor: "black", height: "100vh"}}>
          <div style={{position: "absolute"}}>
            <Link className="App-link" to="/">Home</Link>
            &nbsp;|&nbsp;
            <Link className="App-link" to="/page2">Page2</Link>
            <p>{params.lobby_id} {userContext.username}</p>
          </div>
          <div style={{height: "100%", display: "flex"}}>
            <ControlledCube
                cube={cube}
                style={{
                    height: "100%",
                    width: enemies.size == 0 ? "100%" : "70%"
                }}
            />

            <div style={{
                height: "100%",
                width: enemies.size == 0 ? "0%" : "30%",
            }}>
                <EnemyCubes enemies={enemies} />
            </div>
          </div>

            {/* bottom info panel */}
            <div style={{position: "absolute", bottom: 0, width: "100%"}}>
                <Center mb="20">
                    <Stack>
                        {
                            inSolve ?
                            <TimerDisplay timer1={timer} timer2={countdownTimer} />
                            : ""
                        }
                        {
                            !inSolve ?
                            <>
                                <div>
                                    <Center>
                                        <Button color={readyColor} onClick={onReadyClick}>{readyText}</Button>
                                    </Center>
                                </div>
                                <div>
                                    {
                                        isAdmin ? <Center>
                                        <div style={{display: "flex"}}>
                                            <Button disabled={!allReady()} onClick={() => startLobby(false)}>Start lobby</Button>
                                            <Space w="md" />
                                            <Button onClick={() => startLobby(true)}>Start lobby (force)</Button>
                                        </div>
                                    </Center> : ""
                                    }
                                </div>
                            </>
                            : ""
                        }
                    </Stack>
                </Center>
            </div>
        </div>
    );
}