import { Container, Group, Text, Title, Flex, Button } from "@mantine/core";
import { IconArrowLeft, IconHome } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export default function ErrorPage({message} : {message: string}) {
    const navigate = useNavigate();
    return (
        <Flex style={{height: "100vh"}} direction="column" justify="center">
            <Title ta="center" order={1}>Whoops, Something Went Wrong</Title>
            <Text ta="center">{message}</Text>
            <Flex justify="center" gap="md" mt="md">
                <Button
                    onClick={() => { navigate(-1)  }}
                    variant="outline"
                    leftSection={<IconArrowLeft size={15}/>}
                >
                    Go back
                </Button>
                <Button
                    onClick={() => { navigate("/") }}
                    variant="outline"
                    leftSection={<IconHome size={15}/>}
                >
                    Go to homepage
                </Button>
            </Flex>
        </Flex>
    );
}