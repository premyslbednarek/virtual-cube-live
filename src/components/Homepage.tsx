import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// import './App.css';
import {
  Button,
  Space
} from '@mantine/core';
import { io } from 'socket.io-client';
import CreateLobbyButton from './CreateLobby';

export default function Home() {
  const [currentTime, setCurrentTime] = useState(0);
  const [username, setUsername] = useState("");

  useEffect(() => {
    fetch('/api/time').then(res => res.json()).then(data => {
      setCurrentTime(data.time);
    });

    fetch('/api/user_info').then(res => res.json()).then(data => {
      setUsername(data.username);
    })

    const conn = io();
    conn.close();
  }, []);


  return (
    <>
      <h1>Welcome to Rubik's cube racing!</h1>
      <p>The current time is {currentTime}.</p>
      <p>You are logged in as {username}</p>
      <div style={{display: "flex"}}>
        <Link to="/login">
            <Button>
            Login
            </Button>
        </Link>
        <Space w="md" />
        <Link to="/register">
            <Button>
            Register
            </Button>
        </Link>
      </div>
      <CreateLobbyButton />
    </>
  );
}
