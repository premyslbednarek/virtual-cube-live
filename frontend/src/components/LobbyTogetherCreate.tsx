import { Button } from "@mantine/core";
import { useNavigate } from "react-router-dom";

export default function TogetherCreate() {
    const navigate = useNavigate()
    const createLobby = () => {
        fetch("/together/new").then(res => res.json()).then((data: {id: number}) => {
            navigate("/together", {state: {id: data.id}})
        }).catch(err => console.log(err));
    }
    return (
        <Button onClick={createLobby}>Lobby together</Button>
    );
}