import { ActionIcon, Container, Flex, Grid, Kbd, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconKeyboard } from "@tabler/icons-react";
import keybinds from "../cube/keybindings";

export default function KeybindsButton() {
    const [opened, { open, close }] = useDisclosure(false);


    const rows = [...keybinds.entries()].map(([key, move]) => (
            <Flex gap="md" mb="xs">
                <Kbd>{key}</Kbd>
                <Text>{move}</Text>
            </Flex>
        ))

    const columnsCount = 4; // has to divide the number 12 (mantine Grid columns count)
    const per_column = Math.ceil(rows.length / columnsCount);

    let columns: JSX.Element[] = []
    for (let col = 0; col < columnsCount; ++col) {
        const column_rows = rows.slice(per_column * col, (col + 1) * per_column)
        columns.push(
            <Stack>{column_rows}</Stack>
        )
    }

    return (
        <>
            <Modal opened={opened} onClose={close} title="Cube keybinds">
                <Container>
                    <Grid>
                        {
                            columns.map(column => (
                                <Grid.Col span={12 / columnsCount}>{column}</Grid.Col>
                            ))
                        }
                    </Grid>

                </Container>
            </Modal>


            <Tooltip label="Show keybindings" color="blue">
                <ActionIcon size="xl" radius="xl" onClick={open}><IconKeyboard /></ActionIcon>
            </Tooltip>

        </>
    );
}