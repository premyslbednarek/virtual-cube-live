import { Button, Container, Text, Title, Tooltip } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import NavigationPanel from "./NavigationPanel";
import { Statistics } from "./TimeHistory";
import { UserContext } from "../userContext";
import { IconTool } from "@tabler/icons-react";
import { CubeSizeController } from "./useTimedCube";
import TimeList, { Solve } from "./TimeList";

type UserInfo = {
    username: string;
    role: string;
    created_date: string;
    solves: Array<Solve>;
}

export function User({username} : {username: string}) {
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

            <TimeList solves={user.solves} omitUsername />
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