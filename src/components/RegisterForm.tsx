import {
  TextInput,
  PasswordInput,
  Flex,
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
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { GoogleButton } from '../GoogleButton';
import { useContext } from 'react';
import { UserContext } from '../userContext';

export default function RegisterForm(props: PaperProps) {
  const navigate = useNavigate();
  const {fetchData} = useContext(UserContext);
  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = function(e: any) {
    e.preventDefault();
    fetch('/register', {
      method: "POST",
      body: JSON.stringify(form.values)
    }).then(data => {
      console.log(data)
      if (data.status === 200) {
        fetchData();
        navigate(-1);
      } else {
        console.log("bad")
      }
    })
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" className={classes.title}>
        Welcome!
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Do you already have an account?{' '}
        <Link to="/login">
            <Anchor size="sm" component="button" underline="never">
            Login
            </Anchor>
        </Link>
      </Text>

    <Paper radius="md" p="xl" mt={30} withBorder>
      <Text size="lg" fw={500}>
        Register with
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