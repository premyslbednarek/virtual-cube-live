import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// import './App.css';
import {
  Container,
  Center,
  Divider,
  Table
} from '@mantine/core';
import CreateLobbyButton from './CreateLobby';
import { socket } from '../socket';
import UserInfo from './UserInfo';

type LobbyInfo = {
  creator: string
  lobby_id: number
}

export default function Home() {
  const [currentTime, setCurrentTime] = useState(0);
  // eslint-disable-next-line
  const [username, setUsername] = useState("");
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);


  useEffect(() => {
    fetch('/api/time').then(res => res.json()).then(data => {
      setCurrentTime(data.time);
    });

    fetch('/api/user_info').then(res => res.json()).then(data => {
      setUsername(data.username);
    })

    fetch('/api/get_lobbies').then(res => res.json()).then(data => {
      setLobbies(data.data)
    });
  }, []);

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
      setLobbies(lobbies.filter((lobby) => lobby.lobby_id != lobby_id))
    }

    socket.on("lobby_add", onLobbyAdd);
    socket.on("lobby_delete", onLobbyDelete);

    return () => {
      socket.off("lobby_add", onLobbyAdd)
      socket.off("lobby_delete", onLobbyDelete);
    }
  })


  const rows = lobbies.map((lobby: LobbyInfo) => (
    <Table.Tr key={lobby.lobby_id}>
      <Table.Td>{lobby.creator}</Table.Td>
      <Table.Td>{lobby.lobby_id}</Table.Td>
      <Table.Td><Link to={"/lobby/" + lobby.lobby_id}>Join</Link></Table.Td>
    </Table.Tr>
  ))

  return (
    <Center>
    <Container>
      <h1>Welcome to Rubik's cube racing!</h1>
      <p>The current time is {currentTime}.</p>
      <UserInfo />
      <Divider my="md" />
      <CreateLobbyButton />

      <Divider my="md" />

      <Container>
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

      </Container>
    </Container>

    </Center>
  );
}
