import { FormEvent, useContext, useState } from "react";
import { AuthContext } from "../authContext";
import { Text, Anchor, Button, Flex, Modal, PasswordInput, Space, Stack, TextInput, Alert, Switch, } from "@mantine/core";
import { useDisclosure, useToggle } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import { IconExclamationCircle, IconLogin, IconLogout, IconUserCircle, IconUserPlus } from "@tabler/icons-react";
import { Link } from "react-router-dom";

function capitalizeFirstLetter(string: string) {
    // https://www.squash.io/how-to-capitalize-first-letter-in-javascript/
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export default function AuthPanel() {
    // component, which welcomes the user, displays his username
    // shows login/register/logout buttons

    const { authInfo, updateUserContext } = useContext(AuthContext);

    // authentication modal
    const [modalOpened, { open: openAuthModal, close: closeAuthModal }] = useDisclosure(false)

    // modal type - we can toggle between login and register
    const [type, toggle] = useToggle(["login", "register"])

    // error login/registration
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const form = useForm({
        initialValues: {
        username: '',
        password: '',
        confirmPassword: '',
        keepData: true,
        },
    });

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        fetch(`/api/${type}`, {
            method: "POST",
            body: JSON.stringify(form.values)
        }).then(data=>data.json()).then(data => {
            if (data.msg === "ok") {
                closeAuthModal();
                updateUserContext();
            } else {
                setErrorMessage(data.msg)
            }
        })
    }

    const logout = () => {
        fetch("/api/logout").then(res => {
            if (res.status === 200) {
                updateUserContext();
            }
        });
    }


    const openModal = (type: "register" | "login") => {
        // reset error message and previously entered data
        setErrorMessage(null);
        form.reset()
        toggle(type);
        openAuthModal();
    }

    const errorMessageAlert = errorMessage ? (
        <Alert variant="light" color="red" radius="lg" mb={15} icon={<IconExclamationCircle />}>
            {errorMessage}
        </Alert>
    ) : null;

    const formContent = (
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

                { type === "register" &&
                    <PasswordInput
                        withAsterisk
                        label="Confirm password"
                        placeholder="Your password"
                        value={form.values.confirmPassword}
                        onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
                        radius="md"
                    />
                }

                { type === "register" &&
                    <Switch
                        checked={form.values.keepData}
                        onChange={(event) => form.setFieldValue('keepData', event.currentTarget.checked)}
                        label="Keep data from this anonymous account"
                    />}
            </Stack>
            <Anchor component="button" mt={10} type="button" c="dimmed" onClick={() => toggle()} size="xs">
                {type === 'register'
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </Anchor>
            <Flex justify="flex-end">
                <Button type="submit">
                    {type === 'register'
                    ? 'Register'
                    : 'Login'}
                </Button>
            </Flex>
        </form>
    );

    // login, register, logout buttons
    const buttons = authInfo.isLogged ?
        <>
            <Button leftSection={<IconLogout />} onClick={logout}>Logout</Button>
        </> :
        <>
            <Button leftSection={<IconLogin />} onClick={() => openModal("login")}>
            Login
            </Button>
            <Space w="sm" />
            <Button leftSection={<IconUserPlus />} onClick={() => openModal("register")}>
            Register
            </Button>
        </>;

    return (
        <>
            <Modal opened={modalOpened} onClose={closeAuthModal} title={capitalizeFirstLetter(type)} centered>
                { errorMessageAlert }
                { formContent }
            </Modal>

            <Text size="xl" ta="center">Welcome, {authInfo.username }</Text>
            <Flex mt="sm" justify="center">
                <Link to="/profile">
                    <Button leftSection={<IconUserCircle />}>Profile</Button>
                </Link>
                <Space w="sm" />
                { buttons }
            </Flex>
        </>
    );
}