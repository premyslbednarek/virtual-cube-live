// https://socket.io/how-to/use-with-react
import { io } from 'socket.io-client';

export const socket = io({ autoConnect: false });