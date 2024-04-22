import { ActionIcon, Space, Tooltip } from "@mantine/core";
import { IconArrowLeft, IconHome } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export default function NavigationPanel() {
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