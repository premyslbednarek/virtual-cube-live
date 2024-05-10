import { Text, ActionIcon, Button, Modal, Paper, ScrollArea, Space, Table, Title, Menu } from "@mantine/core";
import { print_time } from "../cube/timer";
import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../authContext";
import { useDisclosure } from "@mantine/hooks";
import { Replay } from "../Pages/Replay";
import { IconDeviceTv, IconPlayerPlay, IconX } from "@tabler/icons-react";
import { Statistics } from "./Statistics";

export interface SolveBasic {
    id: number
    time: number,
    completed: boolean,
}

export default function SidePanelTimeList({cubeSize, fromList, continueFn} : {cubeSize: number, fromList?: SolveBasic[], continueFn?: (solve_id: number) => void}) {
    // display previous solves stats and time list
    // when continueFn is passed, continue solve option will be present in not finished solves
    // the solves are either fetched from the server, or are passed as a fromList prop

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
                <TimeListSimple solves={solves} continueFn={continueFn}/>
            </Paper>
        </>
    );
}

// function to sort solves by time, dnfs come last
export function solveComp(a: SolveBasic, b: SolveBasic) {
    if (!a.completed) {
        return 1; // a should come after b
    }
    if (!b.completed) {
        return -1; // a should come before b
    }
    // if both solves are completed, sort them by time
    return a.time - b.time;
}

export function getAverage(solves: Array<SolveBasic>, allowDNF: boolean) : number {
    // get average time in an array of solves
    // if AllowDNF is false, any not completed solve will result in a DNF
    // average, in that case, Infinity is returned, otherwise, DNF solves are ignored
    if (solves.length === 0) {
        return Infinity;
    }
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


export function get_ao(solves: Array<SolveBasic>, size: number) {
    // get "Average Of" - commonly used term in speed cubing
    // for example AO5 - average of five solves is calculated the following way:
    //      the slowest and fastest times are ignored, average from the rest
    //      of the solves is the result

    // ignore at 5% of slowest and fastest solves, but always ignore at least one solve)
    const to_ignore = Math.max(1, Math.floor(size * 0.05))

    solves = [...solves]; // create shallow copy
    solves = solves.sort(solveComp);

    // ignore x first and x last elements, shift whole window by index to the right
    solves = solves.slice(to_ignore, size - to_ignore);
    return getAverage(solves, false);
}

export function print_avg(result: number) : string {
    if (result === Infinity) {
        return "DNF";
    }
    return print_time(result);
}

export interface AverageOf {
    solvesCount: number; // number of solves - ao5, ao12
    best: string;
    last: string;
}

export function TimeListSimple({solves, continueFn} : {solves: Array<SolveBasic>, continueFn?: (solve_id: number) => void}) {
    // show simple time list, containg the solve time, current ao5
    // and "actions" button, which on hover opens a menu with watch replay link
    // and continue solve button if continueFn is passed
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
            <Table.Th>{idx + 5 <= solves.length  ? print_avg(get_ao(solves.slice(idx, idx + 5), 5)) : "-" }</Table.Th>
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
