import { Link } from 'react-router-dom';
// import './App.css';
import {
  Container,
  Center,
  Divider,
  Button
} from '@mantine/core';
import CreateLobbyDiv from './CreateLobby';
import UserInfo from './UserInfo';
import LobbyList from './LobbyList';
import Authentication from './Auth';

export default function Home() {
  return (
    <Center>
      <Container>
        <h1>Welcome to Rubik's cube racing!</h1>

        <Authentication />

        <Divider my="md" />

        <Link to="/solo"><Button>Solo mode</Button></Link>

        <Divider my="md" />

        <UserInfo />

        <Divider my="md" />

        <CreateLobbyDiv />

        <Divider my="md" />

        <LobbyList />
      </Container>
    </Center>
  );
}
