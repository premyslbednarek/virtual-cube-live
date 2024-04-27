import { Table } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { socket } from "../socket";
import { Text } from "@mantine/core"

type LobbyInfo = {
  creator: string
  lobby_id: number
}

export default function LobbyList() {
    const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);

    // fetch lobby data
    useEffect(() => {
        fetch('/api/get_lobbies').then(res => res.json()).then(data => {
            setLobbies(data.data)
        });
    }, [])

    const rows = lobbies.map((lobby: LobbyInfo) => (
        <Table.Tr key={lobby.lobby_id}>
        <Table.Td>{lobby.creator}</Table.Td>
        <Table.Td>{lobby.lobby_id}</Table.Td>
        <Table.Td><Link to={"/lobby/" + lobby.lobby_id}>Join</Link></Table.Td>
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
        setLobbies(lobbies.filter((lobby) => lobby.lobby_id !== lobby_id))
        }

        socket.on("lobby_add", onLobbyAdd);
        socket.on("lobby_delete", onLobbyDelete);

        return () => {
        socket.off("lobby_add", onLobbyAdd)
        socket.off("lobby_delete", onLobbyDelete);
        }
    })

    if (lobbies.length === 0) {
      return <Text>There aren't any online lobbies right now</Text>
    }

    return (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Lobby creator</Table.Th>
              <Table.Th>Lobby id</Table.Th>
              <Table.Th>Lobby join link</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
    );
}