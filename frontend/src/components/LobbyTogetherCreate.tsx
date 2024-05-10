import { Button, Center } from "@mantine/core";
import { IconUsers } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export default function TogetherCreate() {
    const navigate = useNavigate()
    const createLobby = () => {
        fetch("/api/together/new").then(res => res.json()).then((data: {id: number}) => {
            navigate("/together", {state: {id: data.id}})
        }).catch(err => console.log(err));
    }
    return (
        <Center>
            <Button onClick={createLobby} leftSection={<IconUsers />}>Lobby together</Button>
        </Center>
    );
}