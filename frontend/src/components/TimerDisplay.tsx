import { Text } from "@mantine/core";

export default function TimerDisplay({time} : {time: string}) {
    return (
        <Text ta="center" c="green" style={{fontSize: 45}}>{time}</Text>
    );
}