import { FormEvent, useContext, useState } from "react";
import { UserContext } from "../userContext";
import { Anchor, Button, Flex, Modal, PasswordInput, Space, Stack, TextInput, Alert } from "@mantine/core";
import { useDisclosure, useToggle } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { IconExclamationCircle } from "@tabler/icons-react";

function capitalizeFirstLetter(string: string) {
    // https://www.squash.io/how-to-capitalize-first-letter-in-javascript/
    return string.charAt(0).toUpperCase() + string.slice(1);
}


export default function UserInfo() {
    const { userContext, updateUserContext } = useContext(UserContext);
    const [type, toggle] = useToggle(["login", "register"])
    const [modalOpened, {open, close: closeModal}] = useDisclosure(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const form = useForm({
        initialValues: {
        username: '',
        password: '',
        confirmPassword: '',
        },
    });

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        fetch(`/${type}`, {
            method: "POST",
            body: JSON.stringify(form.values)
        }).then(data=>data.json()).then(data => {
            if (data.msg === "ok") {
                closeModal();
                updateUserContext();
            } else {
                setErrorMessage(data.msg)
            }
        })
    }

    const logout = () => {
        fetch("/logout").then(res => {
            if (res.status === 200) {
                console.log("logout successfull");
                updateUserContext();
            }
        });
    }

    if (userContext.isLogged) {
        return (
            <>
                <p>You are logged in as {userContext.username}</p>
                <Button onClick={logout}>Logout</Button>
            </>
        );
    }

    const openModal = (type: string) => {
        setErrorMessage(null);
        form.reset()
        toggle(type);
        open();
    }

    const errorMessageDiv = (
        <Alert variant="light" color="red" radius="lg" mb={15} icon={<IconExclamationCircle />}>
            {errorMessage}
        </Alert>
    );

    return (
        <>
            <Modal opened={modalOpened} onClose={closeModal} title={capitalizeFirstLetter(type)} centered>
                { errorMessage && errorMessageDiv}

                <form onSubmit={onSubmit}>
                    <Stack>
                        <TextInput
                        withAsterisk
                        label="Username"
                        placeholder="Your username"
                        value={form.values.username}
                        onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                        radius="md"
                        />

                        <PasswordInput
                        withAsterisk
                        label="Password"
                        placeholder="Your password"
                        value={form.values.password}
                        onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                        radius="md"
                        />

                        { type === "register" && <PasswordInput
                            withAsterisk
                            label="Confirm password"
                            placeholder="Your password"
                            value={form.values.confirmPassword}
                            onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
                            radius="md"
                        />
                        }
                </Stack>

                <Anchor component="button" mt={10} type="button" c="dimmed" onClick={() => toggle()} size="xs">
                    {type === 'register'
                    ? 'Already have an account? Login'
                    : "Don't have an account? Register"}
                </Anchor>


                <Flex justify="flex-end">
                    <Button type="submit" radius="xl">
                    Login
                    </Button>
                </Flex>
                </form>
            </Modal>

            <div style={{display: "flex"}}>
                    <Button onClick={() => openModal("login")}>
                    Login
                    </Button>
                <Space w="md" />
                    <Button onClick={() => openModal("register")}>
                    Register
                    </Button>
            </div>
        </>
    );
}