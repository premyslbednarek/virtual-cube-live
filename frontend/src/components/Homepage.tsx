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

        <Divider my="md" label="You can solve in solo mode" />

        <Center>
          <Link to="/solo"><Button leftSection={<IconUser />}>Solo mode</Button></Link>
        </Center>

        <Divider my="md" label="go to solve together" />

        <TogetherCreate />

        <Divider my="md" label="create online lobby" />

        <CreateLobbyDiv />

        <Divider my="md" label="or join an existing lobby" />

        <LobbyList />
      </Container>
    </Center>
  );
}
