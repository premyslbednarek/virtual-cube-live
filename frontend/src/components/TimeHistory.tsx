import { Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "../userContext";

export type Solve = {
    id: number
    time: number,
    completed: boolean,
}

function get_mean(solves: Array<Solve>) : string {
    let sum = 0;
    for (const solve of solves) {
        if (!solve.completed) {
            return "-"
        }
        sum += solve.time;
    }
    return print_time(sum / solves.length);
}


function get_ao(solves: Array<Solve>, size: number, to_ignore: number) {
    solves = solves.slice(to_ignore, size - to_ignore);
    console.log(solves)
    return get_mean(solves);
}

export default function TimeHistory({cubeSize, timeList: newTimes} : {cubeSize: number, timeList: Array<Solve>}) {
    // times from past sessions
    const [previousTimes, setPreviousTimes] = useState<Array<Solve>>([])

    const username = useContext(UserContext).userContext.username

    useEffect(() => {
        fetch(`/api/get_solves/${username}/${cubeSize}`)
            .then(res => res.json()).then(data => {
                data.reverse()
                setPreviousTimes(data)
            }).catch(err => console.log(err));
    }, [username, cubeSize])

    const allsolves = newTimes.concat(previousTimes);

    const rows = allsolves.map((solve) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th><Link to={`/replay/${solve.id}`}>play</Link></Table.Th>
        </Table.Tr>
    ))

    const times = allsolves.map((time) => time.time)

    if (allsolves.length === 0) {
        return null;
    }

    return (
        <>
            <div>Solves completed: {allsolves.length}</div>
            <div>Average time = {print_time(times.reduce((sum, time) => time + sum, 0) / allsolves.length)}</div>
            <div>Ao5 = {get_ao(allsolves, 5, 1)}</div>
            <div>Ao12 = {get_ao(allsolves, 12, 1)}</div>
            <Table>
                <Table.Tbody>
                    {rows}
                </Table.Tbody>
            </Table>
        </>
    );
}