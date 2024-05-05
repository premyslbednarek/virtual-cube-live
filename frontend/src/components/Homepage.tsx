import { Link } from 'react-router-dom';
// import './App.css';
import {
  Container,
  Center,
  Divider,
  Button,
  Title,
  Text,
  Flex,
  Space,
} from '@mantine/core';
import CreateLobbyDiv from './CreateLobby';
import LobbyList from './LobbyList';
import Authentication from './Auth';
import { IconTrophy, IconUser } from '@tabler/icons-react';
import TogetherCreate from './LobbyTogetherCreate';
import { UserSearchField } from './UserPage';

function DividerWithText({label} : {label: string}) {
  return <Divider my="md" size="sm" label={<Text>{label}</Text>}></Divider>
}

export default function Home() {
  return (
      <Center style={{height: "100vh"}}>
        <Container>
          <Title order={1}>Welcome to Rubik's Cube Racing!</Title>

          <Authentication />
          <Space h="md" />
          <Flex justify="center" gap="md">
            <Link to="/leaderboard"><Button leftSection={<IconTrophy />}>Leaderboard</Button></Link>
            <UserSearchField />
          </Flex>

          <DividerWithText label="You can solve on your own" />

          <Center>
            <Link to="/solo"><Button leftSection={<IconUser />}>Solo mode</Button></Link>
          </Center>

          <DividerWithText label="share a cube with your friends" />

          <TogetherCreate />

          <DividerWithText label="challenge your friends to a battle" />

          <CreateLobbyDiv />

          <DividerWithText label="or join an existing battle" />

          <LobbyList />
        </Container>
      </Center>
  );
}
