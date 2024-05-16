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
import CreateLobbyPanel from '../components/CreateLobbyPanel';
import LobbyList from '../components/LobbyList';
import AuthPanel from '../components/AuthPanel';
import { IconTrophy, IconUser } from '@tabler/icons-react';
import TogetherCreateButton from '../components/TogetherCreateButton';
import { UserSearchField } from "../components/UserSearchField";

function DividerWithText({label} : {label: string}) {
  return <Divider my="md" size="sm" label={<Text>{label}</Text>}></Divider>
}

export default function HomePage() {
  return (
      <Center style={{height: "100vh"}}>
        <Container>
          <Title order={1}>Welcome to Rubik's Cube Racing!</Title>

          <AuthPanel />
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

          <TogetherCreateButton />

          <DividerWithText label="challenge your friends to a battle" />

          <CreateLobbyPanel />

          <DividerWithText label="or join an existing battle" />

          <LobbyList />
        </Container>
      </Center>
  );
}
