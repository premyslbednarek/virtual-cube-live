import useFetch from "@custom-react-hooks/use-fetch";
import { Center, Container, Pagination, ScrollArea, Table } from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import { print_time } from "../cube/timer";
import { useState } from "react";


type Solve = {
    id: number;
    completed: boolean;
    time: number,
    race_id: number
}

type UserInfo = {
    username: string;
    role: string;
    created_date: string;
    solves: Array<Solve>;
}

export default function UserPage() {
    const { userId } = useParams()
    const rowsPerPage = 20;
    const [page, setPage] = useState(1);

    const { data, loading, error } = useFetch<UserInfo>(`/api/user/${userId}`)

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
            <Table.Th>{solve.completed ? print_time(solve.time) : "DNF"}</Table.Th>
            <Table.Th>{solve.race_id ? solve.race_id : "-"}</Table.Th>
            <Table.Th><Link to={`/replay/${solve.id}`}>Watch replay</Link></Table.Th>
        </Table.Tr>
    ))

    const maxPages = data?.solves ? data.solves.length / rowsPerPage + 1: 0;

    return (
        <>
            <div>
                { data?.username } is {data?.role} and was created on {data?.created_date}
            </div>
            <Container>
                <Table stickyHeader striped>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Solve id</Table.Th>
                            <Table.Th>Solve time</Table.Th>
                            <Table.Th>Race id</Table.Th>
                            <Table.Th>Watch replay</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        { rows }
                    </Table.Tbody>
                </Table>
                <Center>
                    <Pagination value={page} onChange={setPage} total={maxPages}></Pagination>
                </Center>
            </Container>
        </>
    );
}