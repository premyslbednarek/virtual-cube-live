import { Button, Checkbox, Title, NumberInput, Group} from '@mantine/core';
import { useNavigate } from "react-router-dom"
import { useForm } from '@mantine/form';

interface LobbyCreateResponse {
  lobby_id: number;
}

export default function CreateLobbyDiv() {
  const form = useForm({
    initialValues: {
      layers: 3,
      private: false,
      waitTime: 10
    }
  })

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
      <Title order={3}>Create an online lobby</Title>
      <form onSubmit={createLobby}>
        <NumberInput
          style={{width: "30%"}}
          {...form.getInputProps('layers')}
          label="Cube size (2-7)"
          min={2}
          max={7}
        />
        <NumberInput
          style={{width: "30%"}}
          {...form.getInputProps('waitTime')}
          label="Wait time after the solve"
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