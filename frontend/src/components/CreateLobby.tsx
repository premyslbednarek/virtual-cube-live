import { useDisclosure } from '@mantine/hooks';
import { Button, Checkbox, Title, NumberInput, Group} from '@mantine/core';
import { useNavigate } from "react-router-dom"
import { useForm } from '@mantine/form';
import { create } from 'domain';

interface LobbyCreateResponse {
  lobby_id: number;
}

export default function CreateLobbyButton() {
  const form = useForm({
    initialValues: {
      layers: 3,
      private: false,
      waitTime: 10
    }
  })

  // const [opened, { open, close }] = useDisclosure(false);
  const navigate = useNavigate();

  const createLobby = function(e: any) {
    e.preventDefault();
    fetch("/api/lobby_create", {method: "POST", body: JSON.stringify(form.values)})
      .then(res => res.json())
      .then((data: LobbyCreateResponse) => {
        navigate(`/lobby/${data.lobby_id}`);
    })
  }

  return (
    <>
      {/* <Modal opened={opened} onClose={close} title="Lobby creation">
        <Button onClick={createLobby}>Create lobby</Button>
      </Modal> */}
      {/* <Button onClick={open}>Create lobby</Button> */}

      <Title order={3}>Create lobby</Title>
      <form onSubmit={createLobby}>
        <NumberInput
          style={{width: "30%"}}
          {...form.getInputProps('layers')}
          label="cube layers"
          min={2}
          max={7}
        />
        <NumberInput
          style={{width: "30%"}}
          {...form.getInputProps('waitTime')}
          label="wait time"
          min={10}
        />
        <Checkbox
          mt="md"
          label="Private"
          {...form.getInputProps('private', { type: 'checkbox' })}
        />
        <Group mt="md">
          <Button type="submit">Create lobby</Button>
        </Group>
      </form>
    </>
  );
}