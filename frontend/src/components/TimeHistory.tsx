import { Text, ActionIcon, Button, Modal, Paper, ScrollArea, Space, Table, Title, Menu } from "@mantine/core";
import { print_time } from "../cube/timer";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../authContext";
import { useDisclosure } from "@mantine/hooks";
import { Replay } from "./Replay";
import { IconDeviceTv, IconPlayerPlay, IconX } from "@tabler/icons-react";

export interface SolveBasic {
    id: number
    time: number,
    completed: boolean,
}

function getAverage(solves: Array<SolveBasic>, allowDNF: boolean) : number {
    if (solves.length === 0) {
        return Infinity;
    }
    // if AllowDNF is true, any not completed solve will result in a DNF
    // average, in that case, Infinity is returned
    let sum = 0;
    let count = 0;
    for (const solve of solves) {
        if (!solve.completed) {
            if (!allowDNF) {
                return Infinity;
            }
            continue;
        }
        sum += solve.time;
        ++count;
    }
    return sum / count;
}


function get_ao(solves: Array<SolveBasic>, size: number, index = 0) {
    // ignore at 5% of slowest and fastest solves (always ignore at least one solve)
    const to_ignore = Math.max(1, Math.floor(size * 0.05))

    solves = [...solves]; // create shallow copy
    // sort solve times, not completed solves come last
    solves = solves.sort((a, b) => {
        if (!a.completed) {
            return 1; // a should come after b
        }
        if (!b.completed) {
            return -1; // a should come before b
        }
        // if both solves are completed, sort them by time
        return a.time - b.time;
    })
    // ignore x first and x last elements, shift whole window by index to the right
    solves = solves.slice(index + to_ignore, index + size - to_ignore);
    return getAverage(solves, false);
}

function print_avg(result: number) : string {
    if (result === Infinity) {
        return "DNF";
    }
    return print_time(result);
}

interface AverageOf {
    solvesCount: number; // number of solves - ao5, ao12
    best: string;
    last: string;
}

export function Statistics({solves, showCurrent = true} : {solves: Array<SolveBasic>, showCurrent?: boolean}) {
    const averages: AverageOf[] = useMemo(() => {
        let averageSizes = [5]; // always show average of 5
        // if there is enough solves, show bigger averages
        for (const size of [12, 50, 100]) {
            if (size < solves.length) averageSizes.push(size);
        }

        return averageSizes.map((solveCount) => {
            // if there is not enough solves, show "-"
            // can happen if number of solves is less than five
            if (solveCount > solves.length) {
                return {solvesCount: solveCount, best: "-", last: "-"};
            }

            let last = get_ao(solves, solveCount);
            let best = last;

            for (let i = 1; i < solves.length - solveCount; ++i) {
                const avg = get_ao(solves, solveCount, i);
                if (avg < best) {
                    best = avg;
                }
            }

            return {
                solvesCount: solveCount,
                last: print_avg(last),
                best: print_avg(best),
            }
        })
    }, [solves])

    return (
        <>
            <Table>
                <Table.Tbody>
                    <Table.Tr>
                        <Table.Th>Total solves: { solves.length }</Table.Th>
                        <Table.Th>Average: {solves.length ? print_avg(getAverage(solves, true)) : "-"}</Table.Th>
                    </Table.Tr>
                    <Table.Tr>
                        <Table.Th></Table.Th>
                        { showCurrent && <Table.Th>Current</Table.Th> }
                        <Table.Th>Best</Table.Th>
                    </Table.Tr>
                    {
                        averages.map((avg) => (
                            <Table.Tr key={avg.solvesCount}>
                                <Table.Th>AO{avg.solvesCount}</Table.Th>
                                { showCurrent && <Table.Th>{avg.last}</Table.Th> }
                                <Table.Th>{avg.best}</Table.Th>
                            </Table.Tr>
                        ))
                    }
                </Table.Tbody>
            </Table>
        </>
    );
}

export function TimeList({solves, continueFn} : {solves: Array<SolveBasic>, continueFn?: (solve_id: number) => void}) {
    const [opened, { open, close }] = useDisclosure(false);
    const [modalSolveId, setModalSolveId] = useState<string | null>(null);

    const ref = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState(150);

    const updateHeight = () => {
        if (!ref.current) return;
        setHeight(window.innerHeight - ref.current.offsetTop - 20)
    }

    useEffect(() => {
        updateHeight();
    })

    useEffect(() => {
        window.addEventListener("resize", updateHeight);
        return () => {
            window.removeEventListener("resize", updateHeight);
        }
    })


    const rows = solves.map((solve, idx) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{idx + 1}</Table.Th>
            <Table.Th><Text size="lg">{solve.completed ? print_time(solve.time) : "DNF"}</Text></Table.Th>
            <Table.Th>{idx + 5 <= solves.length  ? print_avg(get_ao(solves, 5, idx)) : "-" }</Table.Th>
            <Table.Th>
                <Menu trigger="hover" openDelay={100}>
                    <Menu.Target>
                        <Button size="xs">Actions</Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                            <Menu.Item leftSection={<IconDeviceTv />} onClick={() => {setModalSolveId(String(solve.id)); open()}}>
                                Watch replay
                            </Menu.Item>
                            { continueFn && !solve.completed &&
                                <Menu.Item onClick={() => continueFn(solve.id)} leftSection={<IconPlayerPlay />}>
                                    Continue solve
                                </Menu.Item>
                            }
                    </Menu.Dropdown>
                </Menu>


            </Table.Th>
        </Table.Tr>
    ))

    return (
        <>
            <Modal opened={opened} onClose={close} size="xl" withCloseButton={false} padding={0}>
                <div style={{height: "80vh"}}>
                    <div style={{position: "absolute", right: 0, zIndex: 5}}>
                        <ActionIcon onClick={close} size="xl" radius="xl"><IconX /></ActionIcon>
                    </div>
                    { modalSolveId && <Replay solveId={modalSolveId} /> }
                </div>
            </Modal>

            <ScrollArea ref={ref} h={height}>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>Time</Table.Th>
                            <Table.Th>AO5</Table.Th>
                            <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </>
    );
}

export default function TimeHistory({cubeSize, fromList, continueFn} : {cubeSize: number, fromList?: SolveBasic[], continueFn?: (solve_id: number) => void}) {
    const [solves, setSolves] = useState<Array<SolveBasic>>(fromList !== undefined ? fromList.slice(0) : [])
    const username = useContext(AuthContext).authInfo.username

    useEffect(() => {
        if (username && !fromList) {
            fetch(`/api/get_solves/${username}/${cubeSize}`)
                .then(res => res.json()).then(data => {
                    setSolves(data)
                }).catch(err => console.log(err));
        }
    }, [username, cubeSize, fromList])

    return (
        <>
            <Paper p={10} radius="md">
                <Title order={3} ml={10}>Statistics</Title>
                <Statistics solves={solves} />
            </Paper>
            <Space h="sm" />
            <Paper p={10} radius="md">
                <Title order={3} ml={10}>Time list</Title>
                <TimeList solves={solves} continueFn={continueFn}/>
            </Paper>
        </>
    );
}