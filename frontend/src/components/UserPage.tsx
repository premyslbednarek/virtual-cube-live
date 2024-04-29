import useFetch from "@custom-react-hooks/use-fetch";
import { Center, Container, Flex, Pagination, Slider, Table, Text, Title } from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { print_time } from "../cube/timer";
import { useEffect, useState } from "react";
import NavigationPanel from "./NavigationPanel";
import { Statistics } from "./TimeHistory";


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

    const { data, loading, error } = useFetch<UserInfo>(`/api/user/${username}`)

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error while fetching...</div>
    }

    console.log(data);

    const rows = data?.solves.slice((page - 1)* rowsPerPage, page * rowsPerPage).map((solve) => (
        <Table.Tr key={solve.id}>
            <Table.Th>{solve.id}</Table.Th>
            <Table.Th>{solve.cube_size}x{solve.cube_size}x{solve.cube_size}</Table.Th>
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th>{solve.race_id ? solve.race_id : "-"}</Table.Th>
            <Table.Th><Link to={`/replay/${solve.id}`}>Watch replay</Link></Table.Th>
        </Table.Tr>
    ))

    const maxPages = data?.solves ? Math.ceil(data.solves.length / rowsPerPage) : 0;

    return (
        <>
            <div style={{position: "absolute", top: 0}}>
                <NavigationPanel />
            </div>

            <Container mt="xl">
                <Title order={3} mb="sm">Profile page</Title>
                <Title order={1} style={{textDecoration: "underline"}}>{data?.username}</Title>
                <Text>Profile created on: {data?.created_date}</Text>
                <Text>Total solves: {data?.solves.length}</Text>
            </Container>

            <Container mt="xl">
                <Title order={3}>{statsCubeSize}x{statsCubeSize} Statistics</Title>
                <Flex align="center" gap="md">
                    <Text>Set cube size: </Text>
                    <Slider w="20vh" min={2} max={7} value={statsCubeSize} onChange={setStatsCubeSize}></Slider>
                </Flex>
                { data && data.solves && <Statistics solves={data.solves.filter(solve => solve.cube_size == statsCubeSize)} />}
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