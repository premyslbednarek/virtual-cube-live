import { Button, Center, Container, Pagination, Table, Text, Title, Tooltip } from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { print_time } from "../cube/timer";
import { useCallback, useContext, useEffect, useState } from "react";
import NavigationPanel from "./NavigationPanel";
import { Statistics } from "./TimeHistory";
import { UserContext } from "../userContext";
import { IconTool } from "@tabler/icons-react";
import { CubeSizeController } from "./useTimedCube";


type Solve = {
    id: number;
    completed: boolean;
    time: number,
    race_id: number
    cube_size: number
}

type UserInfo = {
    username: string;
    role: string;
    created_date: string;
    solves: Array<Solve>;
}

export function User({username} : {username: string}) {
    const rowsPerPage = 10;
    const [page, setPage] = useState(1);
    const [statsCubeSize, setStatsCubeSize] = useState(3);

    const {userContext : me} = useContext(UserContext);

    const [user, setUser] = useState<UserInfo | null>(null);

    const fetchData = useCallback(() => {
        fetch(
            `/api/user/${username}`
        ).then(
            res => res.json()
        ).then(
            data => setUser(data)
        ).catch(err => console.log(err));
    }, [username])

    useEffect(() => {
        fetchData();
    }, [fetchData])


    console.log(user);

    const rows = user?.solves.slice((page - 1)* rowsPerPage, page * rowsPerPage).map((solve) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{solve.id}</Table.Th>
            <Table.Th>{solve.cube_size}x{solve.cube_size}x{solve.cube_size}</Table.Th>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th>{solve.race_id ? solve.race_id : "-"}</Table.Th>
            <Table.Th><Link to={`/replay/${solve.id}`}>Watch replay</Link></Table.Th>
        </Table.Tr>
    ))

    const maxPages = user?.solves ? Math.ceil(user.solves.length / rowsPerPage) : 0;

    const adminIcon = user?.role === "admin" ? (
        <Tooltip label="Administrator">
            <IconTool />
        </Tooltip>
    ) : "";

    const makeAdmin = () => {
        fetch(`/api/${username}/make_admin`).then(res => {
            if (res.status === 200) {
                fetchData();
            }
        }).catch(err => console.log(err));
    }

    if (!user) {
        return <Container>User not found..</Container>;
    }

    return (
        <>
            <div style={{position: "absolute", top: 0}}>
                <NavigationPanel />
            </div>

            <Container mt="xl">
                <Title order={3} mb="sm">Profile page</Title>
                <Title order={1} style={{textDecoration: "underline"}}>{user?.username} { adminIcon }</Title>
                <Text>Profile created on: {user?.created_date}</Text>
                <Text>Total solves: {user?.solves.length}</Text>
                { me.isAdmin && user?.role !== "admin" && <Button onClick={makeAdmin}>Make admin</Button> }
            </Container>


            <Container mt="xl">
                <Title order={3}>{statsCubeSize}x{statsCubeSize} Statistics</Title>
                <CubeSizeController value={statsCubeSize} onChange={setStatsCubeSize} />
                { user && user.solves && <Statistics solves={user.solves.filter(solve => solve.cube_size === statsCubeSize)} />}
            </Container>


            <Container mt="xl">
                <Title order={3}>Solve history</Title>
                <Table stickyHeader striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Solve id</Table.Th>
                            <Table.Th>Cube size</Table.Th>
                            <Table.Th>Solve time</Table.Th>
                            <Table.Th>Race id</Table.Th>
                            <Table.Th>Watch replay</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        { rows }
                    </Table.Tbody>
                </Table>
                <Center mt="sm">
                    <Pagination value={page} onChange={setPage} total={maxPages}></Pagination>
                </Center>
            </Container>
        </>
    );
}

export default function UserPage() {
    const { username } = useParams()

    if (!username) {
        return <div>User with this username does not exist.</div>;
    }

    return <User username={username} />
}