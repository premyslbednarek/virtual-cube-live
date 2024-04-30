import { useParams } from "react-router-dom"
import React, { useEffect, useState, useMemo } from "react"
import Cube from "../cube/cube";
import { parse_move } from "../cube/move";
import {
    Badge,
    Button,
    Center,
    Stack,
    Space,
    Table,
    Title,
    Text
} from "@mantine/core"
import * as THREE from 'three';
import { socket } from "../socket";
import './lobby.css'
import { UserContext } from "../userContext";
import { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import produce from "immer";
import { print_time } from "../cube/timer";
import NavigationPanel from "./NavigationPanel";
import useStopwatch from "./useTimer";
import useCountdown from "./useCountdown";
import { ControlledCube, RenderedCube } from "./CubeCanvases";
import Invitation from "./Invitation";

type LobbyPoints = Array<{
    username: string;
    points: number;
}>;

type RaceResults = Array<{
    username: string;
    time: number;
    pointsDelta: number;
}>;

interface onRaceDoneData {
    results: RaceResults;
    lobbyPoints: LobbyPoints;
}

type Enemy = {
    cube: Cube,
    readyStatus: boolean
    time?: number
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
        <div key={username} style={{height: "100%", position: "relative"}}>
            <div className="absolute">
                <Badge mt="sm" ml="sm" mr="sm">{username}</Badge>
                <Badge color={readyColor}>{readyText}</Badge>
            </div>
            <RenderedCube cube={enemy.cube} />
            <div style={{position: "absolute", bottom: 0, textAlign: "center", width: "100%", fontSize: "25px"}}>
                { enemy.time ? print_time(enemy.time) : "" }
            </div>
        </div>
    );
}

function Results({lastResult, lobbyPoints} : {lastResult: RaceResults, lobbyPoints: LobbyPoints }) {
    const lastRaceRows = lastResult
            .filter((result) => result.time) // filter finished solves - time is not DNF
            .map(({username, time, pointsDelta}) => (
        <Table.Tr key={username}>
            <Table.Td>{username}</Table.Td>
            <Table.Td>{print_time(time)}</Table.Td>
            <Table.Td><Center>+{pointsDelta}</Center></Table.Td>
        </Table.Tr>
    ))

    const lastRaceDNFs = lastResult
            .filter((result) => !result.time) // filter unfinished solves
            .map((result) => (
        <Table.Tr key={result.username}>
            <Table.Td>{result.username}</Table.Td>
            <Table.Td>{"DNF"}</Table.Td>
            <Table.Td><Center>-</Center></Table.Td>
        </Table.Tr>
    ))

    const pointsRows = lobbyPoints.map(({username, points}) => (
        <Table.Tr key={username}>
            <Table.Td>{username}</Table.Td>
            <Table.Td><Center>{points}</Center></Table.Td>
        </Table.Tr>
    ))

    return (
        <div style={{position: "absolute", bottom: 20, left: 20}}>
            { lastResult.length !== 0 &&
                <>
                    <Title order={4}>Last race results</Title>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Username</Table.Th>
                                <Table.Th>Time</Table.Th>
                                <Table.Th>Points</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            { lastRaceRows }
                            { lastRaceDNFs }
                        </Table.Tbody>
                    </Table>
                </>
            }
            {
                <>
                    <Title mt={10} order={4}>Total points</Title>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Username</Table.Th>
                                <Table.Th><Center>Points</Center></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            { pointsRows }
                        </Table.Tbody>
                    </Table>
                </>
            }
        </div>
    );
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
    const [lastRaceResults, setLastRaceResults] = useState<RaceResults>([]);
    const [lobbyPoints, setLobbyPoints] = useState<LobbyPoints>([]);

    const [beforeFirstSolve, setBeforeFirstSolve] = useState(true);
    // server timer matters - upon solve end, adjust the on-screen timer
    // to match server timers
    const [solveTime, setSolveTime] = useState<number | null>(null);

    const [errorMSG, setErrorMSG] = useState<string | null>(null);

    const { formattedTime, start, stop } = useStopwatch();
    const {
        secondsLeft: inspectionSecondsLeft,
        start: startCountdown,
        isRunning: inspectionRunning
    } = useCountdown();
    const {
        secondsLeft: waitTimeLeft,
        start: startWaitTime,
        isRunning: waitTimeRunning,
        stop: stopWaitTime
    } = useCountdown();

    const cube = useMemo(() => new Cube(cubeSize), [cubeSize]);

    interface requestSolution {
        moves_done: Array<string>
    }

    const solveTheCube = () => {
        if (!inSolve) {
            return;
        }
        fetch("/api/request_solution", {
            method: "POST",
            body: JSON.stringify({lobby_id: lobby_id})
        }).then(res => res.json()).then(async function(data: requestSolution) {
            for (let i = data.moves_done.length - 1; i >= 0; --i) {
                const moveObj = parse_move(data.moves_done[i]);
                moveObj.reverse();
                cube.makeMove(moveObj.toString());
                await new Promise(r => setTimeout(r, 200));
            }
        }).catch(error => console.log(error))
    }

    useHotkeys("ctrl+1", solveTheCube);

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
    }, [enemies, cube]);

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

    const onConnection = ({username, points} : {username: string, points: number}) => {
        console.log(username, "has joined the lobby");
        setLobbyPoints(produce((draft) => {
            if (draft.find((el) => el.username === username)) return;
            draft.push({username: username, points: points})
        }))
        setEnemies(new Map(enemies.set(username, {cube: new Cube(cubeSize), readyStatus: false })));
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
            enemy.time = undefined;
        }

        setInSolve(true);
        setReady(false);
        setEnemies(updatedEnemies);
        setBeforeFirstSolve(false);
        setSolveTime(null);
        cube.setState(state);
        cube.startInspection();

        startCountdown(3, () => {
            start();
            cube.startSolve();
        })
    }

    const onSolved = ({time} : {time : number}) => {
        setSolveTime(time);
        // setInSolve(false);
    }


    interface IAnotherSolved {
        "username": string;
        "time": number;
    }
    const onSomebodySolved = (data: IAnotherSolved) => {
        const updated = new Map(enemies);
        const enemy = updated.get(data.username);
        if (!enemy) return;
        enemy.time = data.time;
        setEnemies(updated);
    }

    useEffect(() => {
        socket.connect();
        console.log("connection to socket...")

        cube.init_keyboard_controls();
        cube.init_camera_controls();
        cube.init_mouse_moves();

        interface LobbyConnectResponseSuccess {
            status: 200;
            userList: Array<[string, boolean, string]>; // username, ready, points
            isAdmin: boolean;
            cubeSize: number;
            points: LobbyPoints
        }

        interface LobbyConnectResponseError {
            status: 400;
            msg: string;
        }

        socket.emit("lobby_connect",
            { lobby_id: lobby_id },
            function(response: LobbyConnectResponseSuccess | LobbyConnectResponseError) {
                console.log(response)
                if (response.status === 400) {
                    setErrorMSG(response.msg)
                    return;
                }

                const m = new Map(enemies);
                response.userList.forEach(([username, ready, state]) => {
                    m.set(username, {cube: new Cube(response.cubeSize, state), readyStatus: ready});
                });

                setLobbyPoints(response.points)
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

    const onRaceDone = (data: onRaceDoneData) => {
        stop();
        stopWaitTime();
        setLastRaceResults(data.results);
        setLobbyPoints(data.lobbyPoints);
        setInSolve(false);
    }

    const onStartCountdown = ({waitTime} : {waitTime: number}) => {
        startWaitTime(waitTime, () => {});
    }

    useEffect(() => {
        socket.on("lobby_ready_status_", onReadyChange);
        socket.on("solve_completed", onSomebodySolved)
        socket.on("your_solve_completed", onSolved);
        socket.on("lobby_move", onMove);
        socket.on("lobby_camera", onCamera);
        socket.on("lobby_connection", onConnection);
        socket.on("lobby_disconnection", onDisconnection)
        socket.on("match_start", onMatchStart);
        socket.on("lobby_race_done", onRaceDone);
        socket.on("solve_end_countdown", onStartCountdown);
        return () => {
            socket.off("lobby_connection", onConnection);
            socket.off("solve_completed", onSomebodySolved)
            socket.off("your_solve_completed", onSolved);
            socket.off("lobby_disconnection", onDisconnection)
            socket.off("lobby_ready_status_", onReadyChange);
            socket.off("lobby_move", onMove);
            socket.off("lobby_camera", onCamera);
            socket.off("match_start", onMatchStart);
            socket.off("lobby_race_done", onRaceDone);
            socket.off("solve_end_countdown", onStartCountdown);
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

    const displayTime = <div style={{
        textAlign: "center",
        fontSize: "40px",
        lineHeight: "40px",
        padding: 0,
    }}>
        { inspectionRunning && <div>{inspectionSecondsLeft}</div> }
        { !inspectionRunning && inSolve && solveTime == null && formattedTime }
        { !inspectionRunning && solveTime != null && print_time(solveTime)}
        { !inspectionRunning && !inSolve && !beforeFirstSolve && solveTime == null && "DNF"}
    </div>

    if (!lobby_id) {
        return null;
    }

    if (errorMSG) {
        return <div>{errorMSG}</div>
    }

    return (
        <div style={{ backgroundColor: "black", height: "100vh"}}>
          <Invitation show={!inSolve} lobbyId={lobby_id} />
          <div style={{position: "absolute"}}>
            <NavigationPanel />
            <Text ml={10}>You are logged in as {userContext.username}</Text>
            {
                // show solve button for app admins
                ( userContext.isAdmin && inSolve) && <Button ml={10} onClick={solveTheCube}>Solve</Button>
            }
          </div>
          <div style={{height: "100%", display: "flex"}}>
            <ControlledCube cube={cube} />

            <div style={{
                position: "absolute",
                right: 0,
                height: "100%",
                width: enemies.size === 0 ? "0%" : "30%",
            }}>
                <EnemyCubes enemies={enemies} />
            </div>
          </div>

            {/* bottom info panel */}
            <div style={{position: "absolute", bottom: 0, width: "100%"}}>
                <Center mb="20">
                    <Stack gap="xs" justify="flex-end">
                        {
                            waitTimeRunning &&
                            <div style={{
                                textAlign: "center",
                                color: "red",
                                fontSize: "40px",
                                lineHeight: "40px"
                            }}>
                                { waitTimeLeft }
                            </div>
                        }
                        {displayTime}
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
            { !inSolve && <Results lastResult={lastRaceResults} lobbyPoints={lobbyPoints} /> }
        </div>
    );
}