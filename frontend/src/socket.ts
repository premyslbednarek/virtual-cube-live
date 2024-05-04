// https://socket.io/how-to/use-with-react
import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
// const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:4000';
localStorage.debug = '*';

// interface ServerToClient {
//     your_solve_completed: (data: {time: number, solve_id: number }) => void;
// }

// interface ClientToServer {

// }

// export const socket: Socket<ServerToClient, ClientToServer> = io({ autoConnect: false });
export const socket = io({ autoConnect: false });