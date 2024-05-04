import { ActionIcon, Table } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { print_time } from "../cube/timer";

interface SolveInfo {
    id: number,
    time: number,
    cube_size: number
}

export default function ShowSolvesToContinue({onContinue} : {onContinue: (solve_id: number) => void}) {
    const [solves, setSolves] = useState<Array<SolveInfo>>([]);

    useEffect(() => {
        fetch("/api/solves_to_continue").then(res => res.json()).then((data: {solves: Array<SolveInfo>}) => {
            setSolves(data.solves);
        }).catch(err => console.log(err));
    }, [])

    const rows = solves.slice(0).reverse().map(solve => (
        <Table.Tr key={solve.id}>
            <Table.Td>{solve.id}</Table.Td>
            <Table.Td>{solve.cube_size}x{solve.cube_size}</Table.Td>
            <Table.Td>{print_time(solve.time)}</Table.Td>
            <Table.Td><ActionIcon onClick={() => onContinue(solve.id)}><IconPlayerPlay></IconPlayerPlay></ActionIcon></Table.Td>
        </Table.Tr>
    ));

    return (
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Solve ID</Table.Th>
                    <Table.Th>Cube Size</Table.Th>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Continue</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {rows}
            </Table.Tbody>
        </Table>
    );
}