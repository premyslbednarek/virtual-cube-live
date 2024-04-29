import { Paper, ScrollArea, Space, Table, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";
import { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../userContext";

export type Solve = {
    id: number
    time: number,
    completed: boolean,
}

function getAverage(solves: Array<Solve>, allowDNF: boolean) : number {
    if (solves.length == 0) {
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


function get_ao(solves: Array<Solve>, size: number, to_ignore: number, index = 0) {
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

export function Statistics({solves, showCurrent = true} : {solves: Array<Solve>, showCurrent?: boolean}) {
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

            // ignore at 5% of slowest and fastest solves (always ignore at least one solve)
            const solves_to_ignore = Math.max(1, Math.floor(solveCount * 0.05))

            let last = get_ao(solves, solveCount, solves_to_ignore);
            let best = last;

            for (let i = 1; i < solves.length - solveCount; ++i) {
                const avg = get_ao(solves, solveCount, solves_to_ignore, i);
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
        <Paper p={10} radius="md">
            <Title order={3} ml={10}>Statistics</Title>
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
        </Paper>
    );
}

export function TimeList({solves} : {solves: Array<Solve>}) {
    const rows = solves.map((solve, idx) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{idx + 1}</Table.Th>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th><Link to={`/replay/${solve.id}`}>replay</Link></Table.Th>
        </Table.Tr>
    ))

    if (solves.length === 0) {
        return null;
    }

    return (
        <Paper p={10} radius="md">
            <Title order={3} ml={10}>Time list</Title>
            <ScrollArea h={"50vh"}>
                <Table>
                    <Table.Tbody>
                        {rows}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Paper>
    );
}

export default function TimeHistory({cubeSize} : {cubeSize: number}) {
    const [solves, setSolves] = useState<Array<Solve>>([])
    const username = useContext(UserContext).userContext.username

    useEffect(() => {
        fetch(`/api/get_solves/${username}/${cubeSize}`)
            .then(res => res.json()).then(data => {
                setSolves(data)
            }).catch(err => console.log(err));
    }, [username, cubeSize])

    return (
        <>
            <Statistics solves={solves} />
            <Space h="sm" />
            <TimeList solves={solves} />
        </>
    );
}