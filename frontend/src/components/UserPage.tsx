import { Alert, Button, Container, Flex, Text, Title, Tooltip } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import NavigationPanel from "./NavigationPanel";
import { Statistics } from "./TimeHistory";
import { UserContext } from "../userContext";
import { IconBan, IconTool } from "@tabler/icons-react";
import { CubeSizeController } from "./useTimedCube";
import TimeList, { Solve } from "./TimeList";

type UserInfo = {
    username: string;
    role: string;
    banned: boolean;
    created_date: string;
    solves: Array<Solve>;
}

export function User({username} : {username: string}) {
    const [statsCubeSize, setStatsCubeSize] = useState(3);

    const {userContext : me} = useContext(UserContext);

    const [user, setUser] = useState<UserInfo | null>(null);
    const [solves, setSolves] = useState<Solve[]>([]);

    const fetchData = useCallback(() => {
        fetch(
            '/api/user_info', {
                method: "POST",
                body: JSON.stringify({username: username})
            }
        ).then(
            res => res.json()
        ).then(
            (data: UserInfo) => {
                setUser(data);
                setSolves(data.solves);
            }
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

    const updateBannedStatus = (newStatus: boolean) => {
        fetch("/api/update_banned_status", {
            method: "POST",
            body: JSON.stringify({username: user.username, status: newStatus})
        }).then(res => {
            if (res.status === 200) {
                fetchData();
            }
        }).catch(error => console.log(error))
    }

    const stats = (
        <>
            <Container mt="xl">
                <Title order={3}>{statsCubeSize}x{statsCubeSize} Statistics</Title>
                <CubeSizeController value={statsCubeSize} onChange={setStatsCubeSize} />
                { user && user.solves && <Statistics solves={user.solves.filter(solve => solve.cube_size === statsCubeSize)} />}
            </Container>

            <TimeList solves={solves} setSolves={setSolves} />
        </>
    )

    return (
        <>
            <div style={{position: "absolute", top: 0}}>
                <NavigationPanel />
            </div>

            <Container mt="xl">
                <Title order={3} mb="sm">Profile page</Title>
                <Flex align="center" gap="xs">
                    <Title order={1} style={{textDecoration: "underline"}}>{user?.username} </Title>
                    { adminIcon }
                    { me.isAdmin && user.role != "admin" &&
                        <Button
                            onClick={() => updateBannedStatus(!user.banned)}
                            color={user.banned ? "green" : "red"}
                        >{user.banned ? "Unban" : "ban"} account</Button>
                    }
                    { me.isAdmin && user?.role !== "admin" && <Button onClick={makeAdmin}>Make admin</Button> }
                </Flex>
                <Text>Profile created on: {user?.created_date}</Text>
                { !user.banned && <Text>Total solves: {user?.solves.length}</Text> }

                { user.banned &&
                    <Alert mt="md" color="red" icon={<IconBan />}>
                        This account has been suspended.
                    </Alert>}
            </Container>

            { (!user.banned || me.isAdmin) && stats }
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