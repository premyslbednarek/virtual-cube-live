import { ActionIcon, TextInput, Tooltip } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";


export function UserSearchField() {
    const [value, setValue] = useState("");
    const [error, setError] = useState(false);
    const navigate = useNavigate();

    const onSubmit = () => {
        fetch("/api/is_user", {
            method: "POST",
            body: JSON.stringify({ username: value })
        }).then(res => {
            if (res.status === 200) {
                navigate(`/user/${value}`);
            } else if (res.status === 404) {
                setError(true);
            }
        }).catch(err => { });
    };

    const submit = (
        <Tooltip label="Submit">
            <ActionIcon onClick={onSubmit}>
                <IconSearch />
            </ActionIcon>
        </Tooltip>
    );

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <TextInput
                value={value}
                onChange={(event) => { setError(false); setValue(event.currentTarget.value); }}
                placeholder="Find User by Username"
                error={error}
                rightSection={submit}>
            </TextInput>
        </form>
    );

}
