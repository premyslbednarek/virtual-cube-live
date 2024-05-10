import { ActionIcon, Space, Switch, Table } from "@mantine/core";
import { IconCheck, IconPlayerPlay, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { print_time } from "../cube/timer";

interface SolveInfo {
    id: number,
    time: number,
    manually_saved: boolean
    cube_size: number
}

export default function ContinuableSolvesButton({onContinue} : {onContinue: (solve_id: number) => void}) {
    // a button, clicking it will open a modal with a list of solves, that were unfinished in the past
    // for each solves, its shows its id, cube size, whether it is manually saved or not, current time
    // and a button to continue the solve
    // there is a switch for filtering whether to only show manually solved solves

    const [solves, setSolves] = useState<Array<SolveInfo>>([]);
    const [showOnlySaved, setShowOnlySaved] = useState(false);

    useEffect(() => {
        fetch("/api/solves_to_continue").then(res => res.json()).then((data: {solves: Array<SolveInfo>}) => {
            setSolves(data.solves);
        }).catch(err => console.log(err));
    }, [])

    // if the switch is checked, show only solves which were manually solved
    const filteredSolves = showOnlySaved ? solves.filter((solve) => solve.manually_saved) : solves;

    const rows = filteredSolves.slice(0).reverse().map(solve => (
        <Table.Tr key={solve.id}>
            <Table.Td>{solve.id}</Table.Td>
            <Table.Td>{solve.cube_size}x{solve.cube_size}</Table.Td>
            <Table.Td>{solve.manually_saved ? <IconCheck /> : <IconX />}</Table.Td>
            <Table.Td>{print_time(solve.time)}</Table.Td>
            <Table.Td><ActionIcon onClick={() => onContinue(solve.id)}><IconPlayerPlay></IconPlayerPlay></ActionIcon></Table.Td>
        </Table.Tr>
    ));

    return (
        <>
            <Switch
                checked={showOnlySaved}
                onChange={(event) => setShowOnlySaved(event.currentTarget.checked)}
                label="Show only manually saved solves"
            />

            <Space h="md" />

            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Solve ID</Table.Th>
                        <Table.Th>Cube Size</Table.Th>
                        <Table.Th>Manually saved</Table.Th>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Continue</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {rows}
                </Table.Tbody>
            </Table>
        </>
    );
}