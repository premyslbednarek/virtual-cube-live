import { Table } from "@mantine/core";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";

export type Time = {
    time: number,
    solve_id: number
}


export default function TimeHistory({timeList} : {timeList: Array<Time>}) {
    const rows = timeList.map((time) => (
        <Table.Tr key={time.solve_id}>
            <Table.Th>{print_time(time.time)}</Table.Th>
            <Table.Th><Link to={`/replay/${time.solve_id}`}>play</Link></Table.Th>
        </Table.Tr>
    ))

    const times = timeList.map((time) => time.time)

    if (timeList.length === 0) {
        return null;
    }

    return (
        <>
            <div>Solves completed: {timeList.length}</div>
            <div>Average time = {print_time(times.reduce((sum, time) => time + sum, 0) / timeList.length)}</div>
            <Table>
                <Table.Tbody>
                    {rows}
                </Table.Tbody>
            </Table>
        </>
    );
}