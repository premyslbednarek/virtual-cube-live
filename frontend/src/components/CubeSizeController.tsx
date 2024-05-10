import { ActionIcon, Flex, Text } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { MIN_CUBE_SIZE, MAX_CUBE_SIZE } from "../hooks/useCube";

export function CubeSizeController({ value, onChange }: { value: number; onChange: (newSize: number) => void; }) {
    const changeSize = (delta: number) => {
        let newSize = value + delta;
        if (newSize < MIN_CUBE_SIZE) {
            newSize = MIN_CUBE_SIZE;
        } else if (newSize > MAX_CUBE_SIZE) {
            newSize = MAX_CUBE_SIZE;
        }

        if (newSize !== value) {
            onChange(newSize);
        }
    };

    return (
        <Flex align="center" gap="xs">
            <Text fw={700}>Cube size:</Text>
            <ActionIcon onClick={() => changeSize(-1)}><IconMinus /></ActionIcon>
            <Text fw={700}>{value}</Text>
            <ActionIcon onClick={() => changeSize(+1)}><IconPlus /></ActionIcon>
        </Flex>

    );
}
