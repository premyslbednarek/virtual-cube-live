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
    Tooltip,
    LoadingOverlay
} from "@mantine/core"
import { socket } from "../socket";
import './lobby.css'
import { UserContext } from "../userContext";
import { useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import produce from "immer";
import { print_time } from "../cube/timer";
import NavigationPanel from "./NavigationPanel";
import { RenderedCube } from "./CubeCanvases";
import Invitation from "./Invitation";
import ErrorPage from "./ErrorPage";
import TimeHistory from "./TimeHistory";
import AdminPanelButton from "./LobbyAdminPanel";
import { IconCrown } from "@tabler/icons-react";
import { Overlay } from "./Overlay";
import useTimedCube, { useSpeedMode } from "./useTimedCube";
import TimerDisplay from "./TimerDisplay";
import { useCountdown } from "./TimerHooks";
import KeybindsButton from "./ShowKeybindigs";

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

interface LobbyConnectResponseSuccess {
    status: 200;
    userList: Array<[string, boolean, boolean, string]>;
    isAdmin: boolean;
    cubeSize: number;
    points: LobbyPoints;
    raceTime: number | null;
}

interface LobbyConnectResponseError {
    status: 400;
    msg: string;
}


export default function Lobby() {
    const params = useParams();
    const lobby_id = params.lobby_id;
    const { userContext } = useContext(UserContext);

    const [ready, setReady] = useState(false);
    const [isKicked, setIsKicked] = useState(false);
    const [enemies, setEnemies] = useState<Map<string, Enemy>>(new Map());
    const [isAdmin, setIsAdmin] = useState(false);
    const [cubeSize, setCubeSize] = useState(3);
    const [lastRaceResults, setLastRaceResults] = useState<RaceResults>([]);
    const [lobbyPoints, setLobbyPoints] = useState<LobbyPoints>([]);

    const [errorMSG, setErrorMSG] = useState<string | null>(null);

    const [waitForEnd, setWaitForEnd] = useState(false);

    const { cube, isSolving, setIsSolving, startSolve, stopwatch, stop, timeString, currentTime } = useTimedCube()
    // countdown timer for waiting after the first finisher in the lobby finishes their solve
    const waitTime = useCountdown();

    // togle speed mode for enemy cubes
    const toggleSpeedMode = (newValue: boolean) => {
        for (const enemy of enemies.values()) {
            enemy.cube.setSpeedMode(newValue);
        }
    }

    const speedModeController = useSpeedMode(cube, toggleSpeedMode);

    const solveTheCube = () => {
        if (!isSolving) {
            return;
        }
        fetch("/api/request_solution", {
            method: "POST",
            body: JSON.stringify({lobby_id: lobby_id})
        }).then(res => res.json()).then(async function(data: {moves_done: string[]}) {
            for (let i = data.moves_done.length - 1; i >= 0; --i) {
                const moveObj = parse_move(data.moves_done[i]);
                moveObj.reverse();
                cube.makeMove(moveObj.toString());
                await new Promise(r => setTimeout(r, 200));
            }
        }).catch(error => console.log(error))
    }

    useHotkeys("ctrl+1", solveTheCube, {enabled: isSolving});

    useEffect(() => {
        socket.connect();

        socket.emit("lobby_connect",
            { lobby_id: lobby_id },
            function(response: LobbyConnectResponseSuccess | LobbyConnectResponseError) {
                if (response.status === 400) {
                    setErrorMSG(response.msg)
                    return;
                }

                const m = new Map();
                response.userList.forEach(([username, ready, isAdmin, state]) => {
                    m.set(username, {cube: new Cube(response.cubeSize, state), readyStatus: ready, isAdmin: isAdmin});
                });

                setLobbyPoints(response.points)
                setEnemies(m);
                setIsAdmin(response.isAdmin);
                setCubeSize(response.cubeSize);

                if (response.raceTime !== null) {
                    setWaitForEnd(true);
                    stopwatch.startFromTime(response.raceTime);
                }
            }
        )

        return () => {
            socket.disconnect();
        };
    }, [cube, lobby_id])

    // **************************************
    // BEGIN SOCKET EVENT HANDLER DEFINITIONS
    // **************************************
    const onReadyChange = ({ready_status, username} : {ready_status: boolean, username: string}) => {
        const updated = new Map(enemies);
        const enemy = updated.get(username);
        if (!enemy) return;
        enemy.readyStatus = ready_status;
        setEnemies(updated);
    }

    const onSomebodySolved = (data: {username: string, time: number}) => {
        const updated = new Map(enemies);
        const enemy = updated.get(data.username);
        if (!enemy) return;
        enemy.time = data.time;
        setEnemies(updated);
    }

    const onSolved = ({time} : {time : number}) => {
        stop(time, true);
    }

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

    function resizeCanvases() {
        cube.resizeCanvas();
        for (const enemy of enemies.values()) {
            enemy.cube.resizeCanvas();
        }
    }

    const onConnection = ({username, points, isAdmin} : {username: string, points: number, isAdmin: boolean}) => {
        setLobbyPoints(produce((draft) => {
            if (draft.find((el) => el.username === username)) return;
            draft.push({username: username, points: points})
        }))
        resizeCanvases();
        setEnemies(new Map(enemies.set(username, {cube: new Cube(cubeSize), readyStatus: false, isAdmin: isAdmin })));
    };

    const onDisconnection = ({username} : {username: string}) => {
        resizeCanvases();
        setEnemies(new Map(enemies));
    };


    const onMatchStart = ({state, startTime} : {state: string, startTime: string}) => {
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

    const onRaceDone = (data: onRaceDoneData) => {
        setWaitForEnd(false);
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

    // ***************************************
    // END OF SOCKET EVENT HANDLER DEFINITIONS
    // ***************************************

    function isEverybodyReady() : boolean {
        for (const enemy of enemies.values()) {
            if (!enemy.readyStatus) {
                return false;
            }
        }
        return ready;
    }

    const onReadyButtonClick = () => {
        socket.emit(
            "lobby_ready_status",
            {lobby_id: lobby_id, ready_status: !ready}
        )
        setReady(!ready);
    }

    function onStartLobbyClick(force: boolean) : void {
        socket.emit(
            "lobby_start",
            { lobby_id: lobby_id, force: force }
        )
    }

    const raceEndCountdown = waitTime.isRunning && (
        <div style={{ textAlign: "center", color: "red", fontSize: "40px", lineHeight: "40px" }}>
            { waitTime.secondsLeft }
        </div>
    );

    const beforeSolveButtons = !isSolving && (
        <>
            <Center>
                <Button
                    color={ready ? "green" : "red"}
                    onClick={onReadyButtonClick}
                >
                    {"YOU ARE " + (ready ? "  READY" : "UNREADY") + " (PRESS TO TOGGLE)"}
                </Button>
            </Center>
            <div>
                { isAdmin &&
                    <Center>
                        <Button
                            disabled={!isEverybodyReady()}
                            onClick={() => onStartLobbyClick(false)}
                        >
                            Start lobby
                        </Button>
                        <Space w="md" />
                        <Button
                            onClick={() => onStartLobbyClick(true)}
                        >
                            Start lobby (force)
                        </Button>
                    </Center>
                }
            </div>
        </>
    );

    const bottomPanel = (
        <Overlay position="bottom">
            <Stack gap="xs">
                { raceEndCountdown }
                { isSolving && currentTime && <TimerDisplay time={stopwatch.formattedTime} />}
                <TimerDisplay time={timeString} />
                { beforeSolveButtons }
            </Stack>
        </Overlay>
    );

    const rightPanel = enemies.size ? (
        <Overlay position="right">
            <EnemyCubes enemies={enemies} />
        </Overlay>
    ) : null;

    const leftPanel = (
        <Overlay position="left">
            <Flex align="center">
                <NavigationPanel />
                <KeybindsButton />
                <Space w="md" />
                { isAdmin && <AdminPanelButton enemies={enemies} /> }
            </Flex>
            {
                // show solve button for app admins
                ( userContext.isAdmin && isSolving) && <Button ml={10} onClick={solveTheCube}>Solve</Button>
            }
            { speedModeController }
            { !isSolving && <>
                <Results lastResult={lastRaceResults} lobbyPoints={lobbyPoints} />
                <Space h="sm" />
                <TimeHistory cubeSize={cubeSize} />
            </>}
        </Overlay>
    );

    if (!lobby_id) {
        return <ErrorPage message="Lobby id is not specified" />;
    }

    if (isKicked) {
        return <ErrorPage message="You have been kicked from this lobby"></ErrorPage>
    }

    if (errorMSG) {
        return <ErrorPage message={errorMSG} />
    }

    return (
        <>
          <Invitation show={!isSolving} lobbyId={lobby_id} />
          { rightPanel }
          { bottomPanel }
          { leftPanel }
          <div>
            <LoadingOverlay visible={waitForEnd} loaderProps={{ children: 'Race in progress, waiting until it finishes...' }} />
            <RenderedCube cube={cube} fullscreen />
          </div>
        </>
    );
}