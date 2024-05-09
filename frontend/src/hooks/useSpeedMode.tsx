import { useState } from "react";
import Cube, { DEFAULT_SPEED_MODE } from "../cube/cube";
import { Flex, Switch, Text } from "@mantine/core";



export function useSpeedMode(cube: Cube, onChange?: (newValue: boolean) => void) {
    const [speedMode, setSpeedMode] = useState(DEFAULT_SPEED_MODE);

    const speedModeController = (
        <Flex align="center">
            <Switch
                m={10}
                checked={speedMode}
                onChange={(event) => {
                    const newValue = event.currentTarget.checked;
                    cube.setSpeedMode(newValue);
                    setSpeedMode(newValue);
                    if (onChange) {
                        onChange(newValue);
                    }
                }} />
            <Text fw={700}>Speed mode</Text>
        </Flex>
    );

    return speedModeController;
}
