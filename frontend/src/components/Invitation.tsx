import { Button, Container, Text } from "@mantine/core";
import { useState } from "react";
import CopyButton from "./CopyButton";

export default function Invitation({type, id, show} : {type: "together" | "lobby", id: number, show: boolean}) {
    const [inviteURL, setInviteURL] = useState<string | null>(null);

    const getInviteURL = () => {
        fetch("/api/generate_invitation", {
            method: "POST",
            body: JSON.stringify({type: type, id: id})
        }).then(res => res.json()).then((data: {url: string}) => {
            setInviteURL(window.location.host + "/invite/" + data.url);
        }).catch(err => console.log(err))
    }

    if (!show) {
        return null;
    }

    return (
        <Container ta="center">
            <Text size="xl">Invite your friends!</Text>
            { !inviteURL && <Button onClick={getInviteURL}>Generate invite link</Button>}
            { inviteURL &&
                <>
                    <Text>{inviteURL}</Text>
                    <CopyButton value={inviteURL} />
                </>
            }
        </Container>
    );
}