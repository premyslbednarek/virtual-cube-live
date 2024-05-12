import { Text, Title, Flex, Button } from "@mantine/core";
import { IconArrowLeft, IconHome } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { NavigationButtons } from "../components/NavigationButtons";

export default function ErrorPage({message} : {message: string}) {
    const navigate = useNavigate();
    return (
        <Flex style={{height: "100vh"}} direction="column" justify="center">
            <Title ta="center" order={1}>Whoops, Something Went Wrong</Title>
            <Text ta="center">{message}</Text>
            <NavigationButtons />
        </Flex>
    );
}