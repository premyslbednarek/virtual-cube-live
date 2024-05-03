import { useParams } from "react-router-dom"
import React, { useEffect, useState } from "react"
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
    Paper,
    Flex,
    Tooltip
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
import useCountdown from "./useCountdown";
import { RenderedCube } from "./CubeCanvases";
import Invitation from "./Invitation";
import ErrorPage from "./ErrorPage";
import TimeHistory from "./TimeHistory";
import AdminPanelButton from "./LobbyAdminPanel";
import { IconCrown } from "@tabler/icons-react";
import { Panel } from "./Panels";
import useTimedCube from "./useTimedCube";
import TimerDisplay from "./TimerDisplay";

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

export type Enemy = {
    cube: Cube,
    readyStatus: boolean
    isAdmin: boolean
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
                <Badge mt="sm" ml="sm" mr="sm" rightSection={enemy.isAdmin ? <Tooltip label="lobby admin"><IconCrown size={15} /></Tooltip> : null}>
                        {username}
                </Badge>
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
        <div>
            { lastResult.length !== 0 &&
                <Paper p={10} radius="md" mb="sm">
                    <Title order={3}>Last race results</Title>
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
                </Paper>
            }
            {
                <Paper p={10} radius="md">
                    <Title order={3}>Total points</Title>
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
                </Paper>
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
    const [cubeSize, setCubeSize] = useState(3);
    const [lastRaceResults, setLastRaceResults] = useState<RaceResults>([]);
    const [lobbyPoints, setLobbyPoints] = useState<LobbyPoints>([]);

    const [errorMSG, setErrorMSG] = useState<string | null>(null);

    const { cube, isSolving, setIsSolving, addTime, startSolve, stopwatch, timeString } = useTimedCube()

    const waitTime = useCountdown();


    interface requestSolution {
        moves_done: Array<string>
    }

    const solveTheCube = () => {
        if (!isSolving) {
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

    const onConnection = ({username, points, isAdmin} : {username: string, points: number, isAdmin: boolean}) => {
        console.log(username, "has joined the lobby");
        setLobbyPoints(produce((draft) => {
            if (draft.find((el) => el.username === username)) return;
            draft.push({username: username, points: points})
        }))
        setEnemies(new Map(enemies.set(username, {cube: new Cube(cubeSize), readyStatus: false, isAdmin: isAdmin })));
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

        setReady(false);
        setEnemies(updatedEnemies);
        startSolve({state: state});
    }

    const onSolved = ({time} : {time : number}) => {
        addTime(time);
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

        interface LobbyConnectResponseSuccess {
            status: 200;
            userList: Array<[string, boolean, boolean, string]>; // username, ready, points
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
                response.userList.forEach(([username, ready, isAdmin, state]) => {
                    m.set(username, {cube: new Cube(response.cubeSize, state), readyStatus: ready, isAdmin: isAdmin});
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
        waitTime.stop();
        stopwatch.stop();
        setLastRaceResults(data.results);
        setLobbyPoints(data.lobbyPoints);
        setIsSolving(false);
    }

    const onStartCountdown = ({time} : {time: number}) => {
        waitTime.start(time, () => {});
    }

    const onNewAdmin = ({username} : {username: string}) => {
        if (username === userContext.username) {
            setIsAdmin(true);
        } else {
            const updated = new Map(enemies);
            const enemy = updated.get(username);
            if (!enemy) return;
            enemy.isAdmin = true;
            setEnemies(updated);
        }
    }

    const [isKicked, setIsKicked] = useState(false);

    const onKick = ({username} : {username: string}) => {
        if (username === userContext.username) {
            setIsKicked(true);
        } else {
            const updated = new Map(enemies);
            updated.delete(username);
            setEnemies(updated);
        }
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
        socket.on("lobby_new_admin", onNewAdmin);
        socket.on("lobby_kick", onKick);
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
            socket.off("lobby_new_admin", onNewAdmin);
            socket.off("lobby_kick", onKick);
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

    if (!lobby_id) {
        return null;
    }

    if (errorMSG) {
        return <ErrorPage message={errorMSG} />
    }

    const bottomPanel = (
        <Panel position="bottom">
            <Stack gap="xs">
                {
                    waitTime.isRunning &&
                    <div style={{
                        textAlign: "center",
                        color: "red",
                        fontSize: "40px",
                        lineHeight: "40px"
                    }}>
                        { waitTime.secondsLeft }
                    </div>
                }
                <TimerDisplay time={timeString} />
                {
                    !isSolving ?
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
        </Panel>
    );

    const rightPanel = (
        <>{
            enemies.size
                ?
                    <div style={{position: "absolute", top: 0, right: 0, height: "100%",
                    }}>
                        <EnemyCubes enemies={enemies} />
                    </div>
                : null
        }</>
    );

    const leftPanel = (
        <Panel position="left">
            <Flex align="center">
                <NavigationPanel />
                { isAdmin && <AdminPanelButton enemies={enemies} /> }
            </Flex>
            {
                // show solve button for app admins
                ( userContext.isAdmin && isSolving) && <Button ml={10} onClick={solveTheCube}>Solve</Button>
            }
            { !isSolving && <>
                <Results lastResult={lastRaceResults} lobbyPoints={lobbyPoints} />
                <Space h="sm" />
                <TimeHistory cubeSize={cubeSize} />
            </>}
        </Panel>
    );

    if (isKicked) {
        return <ErrorPage message="You have been kicked from this lobby"></ErrorPage>
    }

    return (
        <>
          <Invitation show={!isSolving} lobbyId={lobby_id} />
          { rightPanel }
          { bottomPanel }
          { leftPanel }
          <RenderedCube cube={cube} fullscreen />
        </>
    );
}