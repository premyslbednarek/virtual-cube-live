import { useDisclosure } from '@mantine/hooks';
import { Modal, Button } from '@mantine/core';
import { useNavigate } from "react-router-dom"

export default function CreateLobbyButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();

  const createLobby = function(e: any) {
    fetch("/api/lobby_create").then(res => res.json()).then(data => {
        const lobby_id = data.lobby_id;
        navigate("/lobby/" + lobby_id);
    })
  }

  return (
    <>
      <Modal opened={opened} onClose={close} title="Lobby creation">
        <Button onClick={createLobby}>Create lobby</Button>
      </Modal>

      <Button onClick={open}>Create lobby</Button>
    </>
  );
}