import { Alert, Button, Center, Group, PasswordInput, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconExclamationCircle } from "@tabler/icons-react";
import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NavigationButtons } from "../components/NavigationButtons";

export function CreateNewPassword() {
    const params = useParams();
    const token = params.token;

    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [sucessMessage, setSuccessMessage] = useState<string | null>(null)
    const navigate = useNavigate();

    const form = useForm({
        initialValues: {
            password: '',
            confirmPassword: '',
        }
    });

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        fetch(`/api/reset_password`, {
            method: "POST",
            body: JSON.stringify({...form.values, token: token})
        }).then(data=>data.json()).then(data => {
            if (data.status === 200) {
                setSuccessMessage("Your password has been reset. Redirecting...")
                setTimeout(() => {navigate("/")}, 3000);
            } else {
                setErrorMessage(data.msg)
            }
        })
        .catch(err => console.log(err))
    }

  return (
    <Center style={{height: "100vh"}}>
        <Stack gap="sm">
            <Title order={1}>
                Reset your password
            </Title>

            { errorMessage &&
                <Alert variant="light" color="red" radius="lg" mb={15} icon={<IconExclamationCircle />}>
                    {errorMessage}
                </Alert>
            }

            { sucessMessage &&
                <Alert variant="light" color="green" radius="lg" mb={15} icon={<IconExclamationCircle />}>
                    {sucessMessage}
                </Alert>
            }

            <form onSubmit={onSubmit}>
                <PasswordInput
                    withAsterisk
                    label="Password"
                    placeholder="Password"
                    value={form.values.password}
                    onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                    radius="md"
                />

                <PasswordInput
                    mt="md"
                    withAsterisk
                    label="Confirm password"
                    placeholder="Confirm password"
                    value={form.values.confirmPassword}
                    onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
                    radius="md"
                />

                <Group justify="flex-end" mt="md">
                <Button type="submit">Submit</Button>
                </Group>
            </form>
            <NavigationButtons />
        </Stack>
    </Center>
  );
}

export function PasswordResetPage() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [sucessMessage, setSuccessMessage] = useState<string | null>(null)
    const navigate = useNavigate();

    const form = useForm({
        initialValues: {
            username: '',
            email: '',
        }
    });

    const baseURL = window.location.protocol + '//' + window.location.host;

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);
        fetch(`/api/new_password_reset`, {
            method: "POST",
            body: JSON.stringify({...form.values, baseURL: baseURL })
        }).then(data=>data.json()).then(data => {
            if (data.status === 200) {
                setSuccessMessage("Success. Check your inbox for an incoming email with further instructions. Redirecting in five seconds...")
                setTimeout(() => {navigate("/")}, 5000);
            } else {
                setErrorMessage(data.msg)
            }
        })
        .catch(err => console.log(err))
    }

  return (
    <Center style={{height: "100vh"}}>
        <Stack gap="sm">
            <Title order={1}>
                Reset your password
            </Title>

            { errorMessage &&
                <Alert variant="light" color="red" radius="lg" mb={15} icon={<IconExclamationCircle />}>
                    {errorMessage}
                </Alert>
            }

            { sucessMessage &&
                <Alert variant="light" color="green" radius="lg" mb={15} icon={<IconExclamationCircle />}>
                    {sucessMessage}
                </Alert>
            }

            <form onSubmit={onSubmit}>
                <TextInput
                    withAsterisk
                    label="Username"
                    placeholder="Your username"
                    value={form.values.username}
                    onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                    radius="md"
                />

                <TextInput
                    mt="md"
                    withAsterisk
                    label="Email"
                    placeholder="Your email"
                    value={form.values.email}
                    onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                    radius="md"
                />

                <Group justify="flex-end" mt="md">
                <Button type="submit">Submit</Button>
                </Group>
            </form>
            <NavigationButtons />
        </Stack>
    </Center>
  );
}