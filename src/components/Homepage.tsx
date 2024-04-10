import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// import './App.css';
import {
  Button,
  Space,
  Container,
  Center,
  Divider,
  Table
} from '@mantine/core';
import CreateLobbyButton from './CreateLobby';
import { socket } from '../socket';

type LobbyInfo = {
  creator: string
  lobby_id: number
}

export default function Home() {
  const [currentTime, setCurrentTime] = useState(0);
  const [username, setUsername] = useState("");
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);

  const onLobbyAdd = (lobby: LobbyInfo) => {
    setLobbies([...lobbies, lobby]);
  }

  useEffect(() => {
    fetch('/api/time').then(res => res.json()).then(data => {
      setCurrentTime(data.time);
    });

    fetch('/api/user_info').then(res => res.json()).then(data => {
      setUsername(data.username);
    })
  }, []);

  useEffect(() => {
    socket.connect();
    socket.on("lobby_add", onLobbyAdd);

    return () => {
      socket.off("lobby_add", onLobbyAdd)
      socket.disconnect();
    }
  }, [])


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
      <p>You are logged in as {username}</p>
      <div style={{display: "flex"}}>
        <Link to="/login">
            <Button>
            Login
            </Button>
        </Link>
        <Space w="md" />
        <Link to="/register">
            <Button>
            Register
            </Button>
        </Link>
      </div>
      <Divider my="md" />
      <CreateLobbyButton />

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
