import { ActionIcon, Button, Flex, Space, Tooltip } from "@mantine/core";
import { IconArrowLeft, IconHome } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export function NavigationIcons() {
    // go back and homepage buttons
    const navigate = useNavigate();
    return (
        <div style={{display: "flex", margin: 10}}>
            <Tooltip label="go back" color="blue">
                <ActionIcon size="xl" radius="xl" onClick={() => navigate(-1)}><IconArrowLeft /></ActionIcon>
            </Tooltip>
            <Space w="sm" />
            <Tooltip label="home" color="blue">
                <ActionIcon size="xl" radius="xl" onClick={() => navigate("/")}><IconHome /></ActionIcon>
            </Tooltip>
        </div>
    );
}

export function NavigationButtons() {
    const navigate = useNavigate();
    return (
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
    );

}