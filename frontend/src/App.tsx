import { AuthContextProvider } from './authContext';
import Router from './Router';

export default function App() {
  return (
    <AuthContextProvider>
      <Router />
    </AuthContextProvider>
  );

}