import { Button, Flex, Text } from "@mantine/core";
import { useState } from "react";
import CopyButton from "../CopyButton";

export default function Invitation({lobbyId, show} : {lobbyId : string, show: boolean}) {
    const [inviteURL, setInviteURL] = useState<string | null>(null);

    const getInviteURL = () => {
        fetch("/api/generate_invitation", {
            method: "POST",
            body: JSON.stringify({lobbyId: lobbyId})
        }).then(res => res.json()).then((data: {url: string}) => {
            setInviteURL(window.location.host + "/invite/" + data.url);
        }).catch(err => console.log(err))
    }

    if (!show) {
        return null;
    }

    return (
        <div style={{position: "absolute", width: "100%", textAlign: "center", marginTop: 10 }}>
            <Text>Invite your friends!</Text>
            { !inviteURL &&
                <Button onClick={getInviteURL}>Generate</Button>}
            { inviteURL &&
                <Flex align="center" justify="center">
                    <Text size="xl">{inviteURL}</Text>
                    <CopyButton value={inviteURL} />
                </Flex>}
        </div>
    );
}