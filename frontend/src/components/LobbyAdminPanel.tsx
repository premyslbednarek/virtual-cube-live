import { useDisclosure } from "@mantine/hooks";
import { Enemy } from "../Pages/Lobby";
import { Flex, Button, Text, Modal, Table, Tooltip } from "@mantine/core";
import { IconCrown } from "@tabler/icons-react";
import { socket } from "../socket";

export default function AdminPanelButton({enemies} : {enemies: Map<string, Enemy>}) {
    const [opened, {open, close}] = useDisclosure(false);

    function make_admin(username: string) {
        socket.emit(
            "lobby_make_admin",
            { "username": username }
        )
    }

    function kick(username: string) {
        socket.emit(
            "lobby_kick",
            { "username": username }
        )
    }

    const rows = [...enemies].map(([username, enemy]) => (
        <Table.Tr key={username}>
            <Table.Td>
                <Flex align="center">
                    <Text>{username}</Text>
                    {enemy.isAdmin && <Tooltip label="lobby admin"><IconCrown /></Tooltip>}
                </Flex>
            </Table.Td>
            <Table.Td>
                <Button onClick={() => make_admin(username)} disabled={enemy.isAdmin} color="green">
                    Make admin
                </Button>
            </Table.Td>
            <Table.Td><Button onClick={() => kick(username)} disabled={enemy.isAdmin} color="red">Kick out of lobby</Button></Table.Td>
        </Table.Tr>
    ))


    return (
        <>
            <Modal opened={opened} onClose={close} title="admin panel" size="auto">
                { enemies.size === 0 && "There are no other users in this lobby"}
                <Table>
                    <Table.Tbody>
                        {rows}
                    </Table.Tbody>
                </Table>
            </Modal>

            <Button onClick={open}>admin panel</Button>
        </>
    );
}