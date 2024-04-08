import {
  TextInput,
  PasswordInput,
  Flex,
  Checkbox,
  Anchor,
  Paper,
  Title,
  Text,
  Container,
  PaperProps,
  Group,
  Button,
} from '@mantine/core';
import {
  Divider,
  Stack,
} from '@mantine/core';
import classes from './LoginForm.module.css';
import { Link } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { useToggle, upperFirst } from '@mantine/hooks';
import { TwitterButton } from '../TwitterButton';
import { GoogleButton } from '../GoogleButton';

export default function LoginForm(props: PaperProps) {
  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = function(e: any) {
    e.preventDefault();
    fetch('/login', {
      method: "POST",
      body: JSON.stringify(form.values)
    })
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" className={classes.title}>
        Welcome back!
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Do not have an account yet?{' '}
        <Link to="/register">
            <Anchor size="sm" component="button" underline="never">
            Create account
            </Anchor>
        </Link>
      </Text>

    <Paper radius="md" p="xl" mt={30} withBorder>
      <Text size="lg" fw={500}>
        Login with
      </Text>

      <Group grow mb="md" mt="md">
        <GoogleButton radius="xl">Google</GoogleButton>
        {/* <TwitterButton radius="xl">Twitter</TwitterButton> */}
      </Group>

      <Divider label="Or continue with an account" labelPosition="center" my="lg" />

      <form onSubmit={onSubmit}>
        <Stack>
          {/* <TextInput
            required
            label="Email"
            placeholder="hello@mantine.dev"
            value={form.values.email}
            onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
            error={form.errors.email && 'Invalid email'}
            radius="md"
          /> */}

          <TextInput
            required
            label="Username"
            placeholder="Your username"
            value={form.values.username}
            onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
            error={form.errors.email && 'Invalid username'}
            radius="md"
          />

          <PasswordInput
            required
            label="Password"
            placeholder="Your password"
            value={form.values.password}
            onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
            error={form.errors.password && 'Password should include at least 6 characters'}
            radius="md"
          />

        </Stack>

        <Flex justify="flex-end" mt="xl">
          <Button type="submit" radius="xl">
            Login
          </Button>
        </Flex>
      </form>
    </Paper>
    </Container>
  );
}