import { Button, Container, Table, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { socket } from "../socket";

type LobbyInfo = {
  creator: string
  id: number
  cubeSize: number;
}

export default function LobbyList() {
    const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);

    // fetch lobby data
    useEffect(() => {
        fetch('/api/get_lobbies')
            .then(res => res.json())
            .then((data: LobbyInfo[]) => {
                setLobbies(data)
            })
            .catch(err => console.log(err));
    }, [])

    const rows = lobbies.map((lobby: LobbyInfo) => (
        <Table.Tr key={lobby.id}>
        <Table.Td>{lobby.id}</Table.Td>
        <Table.Td>{lobby.creator}</Table.Td>
        <Table.Td>{lobby.cubeSize}x{lobby.cubeSize}</Table.Td>
        <Table.Td><Link to={"/lobby/" + lobby.id}><Button size="compact-sm">Join</Button></Link></Table.Td>
        </Table.Tr>
    ))

    useEffect(() => {
        socket.connect();

        return () => {
        socket.disconnect();
        }
    }, [])

    useEffect(() => {
        const onLobbyAdd = (lobby: LobbyInfo) => {
          setLobbies([lobby, ...lobbies]);
        }
        const onLobbyDelete = ({lobby_id} : {lobby_id: number}) => {
          setLobbies(lobbies.filter((lobby) => lobby.id !== lobby_id))
        }

        socket.on("lobby_add", onLobbyAdd);
        socket.on("lobby_delete", onLobbyDelete);

        return () => {
        socket.off("lobby_add", onLobbyAdd)
        socket.off("lobby_delete", onLobbyDelete);
        }
    })

    if (lobbies.length === 0) {
      return <Text ta="center">There aren't any online lobbies right now...</Text>
    }

    return (
        <Container ta="center">
            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th ta="center">Lobby id</Table.Th>
                        <Table.Th ta="center">Lobby creator</Table.Th>
                        <Table.Th ta="center">Cube size</Table.Th>
                        <Table.Th ta="center">Lobby join link</Table.Th>
                    </Table.Tr>
                </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
            </Table>
        </Container>
    );
}