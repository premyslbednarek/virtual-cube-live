import { Alert, Button, Container, Flex, Space, Text, Title, Tooltip } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import { NavigationIcons } from "../components/NavigationButtons";
import { Statistics } from "../components/Statistics";
import { AuthContext } from "../authContext";
import { IconBan, IconTool } from "@tabler/icons-react";
import { CubeSizeController } from "../components/CubeSizeController";
import TimeList, { Solve } from "../components/TimeList";
import { UserSearchField } from "../components/UserSearchField";
import { LineChart } from '@mantine/charts';
import { print_time } from "../cube/timer";
import { getAverage } from "../components/SidePanelTimeList";

type UserInfo = {
    username: string;
    role: string;
    banned: boolean;
    created_date: string;
    solves: Array<Solve>;
}

function TimeChart({solves} : {solves: Array<Solve>}) {
    solves = solves.filter(solve => solve.completed);
    solves.reverse();
    const average = getAverage(solves, true);
    const averageLineLabel = `Average time: ${print_time(average)}`
    return (
        <LineChart
            h={300}
            data={solves}
            dataKey="id"
            xAxisLabel="Solve ID"
            yAxisLabel="time"
            valueFormatter={(value) => print_time(value)}
            series={[
                { name: 'time', color: 'indigo.6' },
            ]}
             referenceLines={[
                { y: average, label: averageLineLabel, color: 'red.6' },
             ]}
            curveType="linear"
        />
  );
}


export function User({username} : {username: string}) {
    const [statsCubeSize, setStatsCubeSize] = useState(3);

    const { authInfo } = useContext(AuthContext);

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

    const statsSolves = user.solves.filter(solve => solve.cube_size === statsCubeSize);

    const stats = (
        <>
            <Container mt="xl">
                <Title order={3}>{statsCubeSize}x{statsCubeSize} Statistics</Title>
                <CubeSizeController value={statsCubeSize} onChange={setStatsCubeSize} />
                {
                    statsSolves.length !== 0 ? (
                        <>
                            <Statistics solves={statsSolves} />
                            <Space h="md" />
                            <Title order={4}>Time history (most recent solves are on the right)</Title>
                            <Space h="sm" />
                            <TimeChart solves={statsSolves} />
                        </>
                    ) : <Text ta="center">No solves for the specified cube size found..</Text>
                }
            </Container>

            <TimeList solves={solves} setSolves={setSolves} rowsPerPage={20} defaultSort="recent" omitUsername/>
        </>
    )



    return (
        <>
            <div style={{position: "absolute", top: 0}}>
                <NavigationIcons />
            </div>

            <Container mt="md">
                <Flex justify="flex-end">
                <UserSearchField />
                </Flex>
                <Title order={3} mb="sm">Profile page</Title>
                <Flex align="center" gap="xs">
                    <Title order={1} style={{textDecoration: "underline"}}>{user?.username} </Title>
                    { adminIcon }
                    { authInfo.isAdmin && user.role !== "admin" &&
                        <Button
                            onClick={() => updateBannedStatus(!user.banned)}
                            color={user.banned ? "green" : "red"}
                        >{user.banned ? "Unban" : "ban"} account</Button>
                    }
                    { authInfo.isAdmin && user?.role !== "admin" && <Button onClick={makeAdmin}>Make admin</Button> }
                </Flex>
                <Text>Profile created on: {user?.created_date}</Text>
                { !user.banned && <Text>Total solves: {user?.solves.length}</Text> }

                { user.banned &&
                    <Alert mt="md" color="red" icon={<IconBan />}>
                        This account has been suspended.
                    </Alert>}
            </Container>

            { (!user.banned || authInfo.isAdmin) && stats }
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