import { Button, Center, Checkbox, Container, Flex, NativeSelect, Pagination, Table, Text, Tooltip, rgba } from "@mantine/core";
import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";
import { IconDeviceTv, IconSortDescending, IconTrash, IconTrashOff } from "@tabler/icons-react";
import { CubeSizeController } from "./CubeSizeController";
import { AuthContext } from "../authContext";
import { produce } from "immer";

export interface Solve {
    id: number;
    completed: boolean;
    time: number;
    race_id?: number;
    cube_size: number;
    username: string;
    banned: boolean;
    deleted: boolean;
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

export function DeleteSolveButton({deleted: deleted_, solve_id, onChange } : {solve_id: number, deleted: boolean, onChange?: (id: number, newVal: boolean) => void}) {
    const [deleted, setDeleted] = useState(deleted_);

    const onClick = () => {
        const newStatus = !deleted;
        fetch('/api/update_solve_deleted_status', {
            method: "POST",
            body: JSON.stringify({id: solve_id, status: newStatus})
        }).then(res => {
            if (res.status === 200) {
                setDeleted(newStatus);
                onChange && onChange(solve_id, newStatus)
            }
        }).catch(err => console.log(err))
    }

    if (deleted) {
        return <Button color="green" onClick={onClick} leftSection={<IconTrashOff />}>Restore</Button>
    }

    return <Button color="red" onClick={onClick} leftSection={<IconTrash />}>Delete </Button>
}

export default function TimeList({solves, setSolves, rowsPerPage=10, omitUsername=false, defaultSort="time"} : {solves: Solve[], setSolves?: React.Dispatch<React.SetStateAction<Solve[]>>, rowsPerPage?: number, omitUsername?: boolean, defaultSort?: string}) {
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState(defaultSort)

    const [cubeSize, setCubeSize] = useState(3);
    const [showAllSizes, setShowAllSizes] = useState(false);

    const { authInfo } = useContext(AuthContext)
    const [showHidden, setShowHidden] = useState(false);


    let to_show = solves;

    if (sortBy === "time") {
        to_show = to_show.slice(0).sort(solveTimeCompare); // sort without mutating original array
    }

    if (!showAllSizes) {
        to_show = to_show.filter(solve => solve.cube_size === cubeSize);
    }

    if (!showHidden) {
        to_show = to_show.filter(solve => !solve.banned && !solve.deleted)
    }

    const pagesCount = Math.ceil(to_show.length / rowsPerPage);

    const onDeletion = (solve_id: number, newValue: boolean) => {
        if (setSolves === undefined) {
            return;
        }
        setSolves(produce((draft) => {
            for (const solve of draft) {
                console.log(solve.id, solve_id)
                if (solve.id === solve_id) {
                    solve.deleted = newValue;
                    console.log("setting")
                    break;
                }
            }
            return draft;
        }))
    }

    const rows = to_show.slice((page - 1)* rowsPerPage, page * rowsPerPage).map((solve, index) => (
        <Table.Tr key={solve.id} style={{backgroundColor: (!solve.banned && !solve.deleted) ? "inherit" : rgba("#ff0000", 0.2)}}>
            { sortBy === "time" && <Table.Th>{(page - 1) * rowsPerPage + index + 1}</Table.Th>}
            { !omitUsername &&
                <Table.Th>
                    <Link to={`/user/${solve.username}`} style={{textDecoration: 'none', color: "white"}}>
                        {solve.username}
                        {solve.banned && " [banned]"}
                    </Link>
                </Table.Th>
            }
            <Table.Th>{solve.cube_size}x{solve.cube_size}x{solve.cube_size}</Table.Th>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th>{solve.race_id ? solve.race_id : "-"}</Table.Th>
            <Table.Th>
                <Link to={`/replay/${solve.id}`}>
                    <Tooltip label="Watch replay">
                        <Button leftSection={<IconDeviceTv />}>
                            Replay
                        </Button>
                    </Tooltip>
                </Link>
            </Table.Th>
            { authInfo.isAdmin &&
                <Table.Td>
                    <DeleteSolveButton deleted={solve.deleted} solve_id={solve.id} onChange={onDeletion}/>
                </Table.Td>}
        </Table.Tr>
    ))
    return (
        <Container mt="xl">
            <Flex align="center" gap="sm" justify="flex-end">
                { !showAllSizes && <CubeSizeController value={cubeSize} onChange={setCubeSize}/> }
                <Checkbox
                    checked={showAllSizes}
                    onChange={(event) => setShowAllSizes(event.currentTarget.checked)}
                    label="Show all cube sizes"
                />
                { authInfo.isAdmin && <Checkbox
                    checked={showHidden}
                    onChange={(event) => setShowHidden(event.currentTarget.checked)}
                    label="Show hidden solves"/>
                }
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
                        { sortBy === "time" && <Table.Th>Rank</Table.Th> }
                        { !omitUsername && <Table.Th>Username</Table.Th>}
                        <Table.Th>Cube size</Table.Th>
                        <Table.Th>Solve time</Table.Th>
                        <Table.Th>Race id</Table.Th>
                        <Table.Th>Watch replay</Table.Th>
                        { authInfo.isAdmin && <Table.Td>Delete solve</Table.Td>}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    { rows }
                </Table.Tbody>
            </Table>
            { rows.length === 0 && <Text ta="center" size="xl">No solves found</Text> }
            <Center mt="sm">
                <Pagination value={page} onChange={setPage} total={pagesCount}></Pagination>
            </Center>
        </Container>
    );
}