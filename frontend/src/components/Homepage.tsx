import { Link } from 'react-router-dom';
// import './App.css';
import {
  Container,
  Center,
  Divider,
  Button,
  Title,
  Text
} from '@mantine/core';
import CreateLobbyDiv from './CreateLobby';
import LobbyList from './LobbyList';
import Authentication from './Auth';
import { IconUser } from '@tabler/icons-react';
import TogetherCreate from './LobbyTogetherCreate';

function DividerWithText({label} : {label: string}) {
  return <Divider my="md" size="sm" label={<Text>{label}</Text>}></Divider>
}

export default function Home() {
  return (
    <Center>
      <Container mt="xl">
        <Title order={1}>Welcome to Rubik's cube racing!</Title>

        <Authentication />

        <DividerWithText label="You can solve on your own" />

        <Center>
          <Link to="/solo"><Button leftSection={<IconUser />}>Solo mode</Button></Link>
        </Center>

        <DividerWithText label="You can share a cube with your friends" />

        <TogetherCreate />

        <DividerWithText label="You can challenge your friends to a battle" />

        <CreateLobbyDiv />

        <DividerWithText label="Or join an existing battle" />

        <LobbyList />
      </Container>
    </Center>
  );
}
