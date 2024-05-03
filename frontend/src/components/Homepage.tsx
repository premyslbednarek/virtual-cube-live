import { Link } from 'react-router-dom';
// import './App.css';
import {
  Container,
  Center,
  Divider,
  Button
} from '@mantine/core';
import CreateLobbyDiv from './CreateLobby';
import LobbyList from './LobbyList';
import Authentication from './Auth';
import { IconUser } from '@tabler/icons-react';
import TogetherCreate from './LobbyTogetherCreate';

export default function Home() {
  return (
    <Center>
      <Container>
        <h1>Welcome to Rubik's cube racing!</h1>

        <Authentication />

        <Divider my="md" label="You can solve on your own" />

        <Center>
          <Link to="/solo"><Button leftSection={<IconUser />}>Solo mode</Button></Link>
        </Center>

        <Divider my="md" label="You can share a cube with your friends" />

        <TogetherCreate />

        <Divider my="md" label="You can challenge your friends to a battle" />

        <CreateLobbyDiv />

        <Divider my="md" label="Or join an existing battle" />

        <LobbyList />
      </Container>
    </Center>
  );
}
