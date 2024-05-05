import { ActionIcon, Anchor, Center, Checkbox, Container, Flex, NativeSelect, Pagination, Table, Text, Title, Tooltip } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";
import { IconPlayerPlay, IconSortDescending } from "@tabler/icons-react";
import { CubeSizeController } from "./useTimedCube";

export interface Solve {
    id: number;
    completed: boolean;
    time: number;
    race_id?: number;
    cube_size: number;
    username: string;
}

function solveTimeCompare(a: Solve, b: Solve) {
    if (!a.completed) {
        return 1; // a should come after b
    }
    if (!b.completed) {
        return -1; // a should come before b
    }
    // if both solves are completed, sort them by time
    return a.time - b.time;
}

export default function TimeList({solves, rowsPerPage=10, omitUsername=false} : {solves: Solve[], rowsPerPage?: number, omitUsername?: boolean}) {
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState("recent")

    const [cubeSize, setCubeSize] = useState(3);
    const [limitToSize, setLimitToSize] = useState(false);


    if (sortBy === "time") {
        solves = solves.slice(0).sort(solveTimeCompare); // sort without mutating original array
    }

    if (limitToSize) {
        solves = solves.filter(solve => solve.cube_size == cubeSize);
    }

    const pagesCount = Math.ceil(solves.length / rowsPerPage);

    const rows = solves.slice((page - 1)* rowsPerPage, page * rowsPerPage).map((solve) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{solve.id}</Table.Th>
            { !omitUsername &&
                <Table.Th>
                    <Link to={`/user/${solve.username}`} style={{textDecoration: 'none', color: "white"}}>
                        {solve.username}
                    </Link>
                </Table.Th>
            }
            <Table.Th>{solve.cube_size}x{solve.cube_size}x{solve.cube_size}</Table.Th>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th>{solve.race_id ? solve.race_id : "-"}</Table.Th>
            <Table.Th>
                <Link to={`/replay/${solve.id}`}>
                    <Tooltip label="Watch replay">
                        <ActionIcon size="sm" m="auto">
                            <IconPlayerPlay />
                        </ActionIcon>
                    </Tooltip>
                </Link>
            </Table.Th>
        </Table.Tr>
    ))
    return (
        <Container mt="xl">
            <Flex align="center" gap="sm" justify="flex-end">
                { limitToSize && <CubeSizeController value={cubeSize} onChange={setCubeSize}/> }
                <Checkbox
                    checked={limitToSize}
                    onChange={(event) => setLimitToSize(event.currentTarget.checked)}
                    label="Limit cube size"
                />
                <Text>Sort by: </Text>
                <NativeSelect
                    value={sortBy}
                    onChange={(event) => setSortBy(event.currentTarget.value)}
                    data={["recent", "time"]}
                    leftSection={<IconSortDescending />}
                />
            </Flex>
            <Table stickyHeader striped>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Solve id</Table.Th>
                        { !omitUsername && <Table.Th>Username</Table.Th>}
                        <Table.Th>Cube size</Table.Th>
                        <Table.Th>Solve time</Table.Th>
                        <Table.Th>Race id</Table.Th>
                        <Table.Th></Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    { rows }
                </Table.Tbody>
            </Table>
            <Center mt="sm">
                <Pagination value={page} onChange={setPage} total={pagesCount}></Pagination>
            </Center>
        </Container>
    );
}