import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './Pages/Homepage';
import Lobby from './Pages/Lobby';
import { ReplayPage } from './Pages/Replay';
import UserPage from './Pages/UserPage';
import SoloMode from './Pages/SoloMode';
import Profile from './Pages/Profile';
import Invite from './Pages/Invite';
import ErrorPage from './Pages/ErrorPage';
import Together from './Pages/Together';
import Leaderboard from './Pages/Leaderboard';
import { CreateNewPassword, PasswordResetPage } from './Pages/PasswordReset';

export default function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lobby/:lobby_id" element={<Lobby />} />
                <Route path="/replay/:solveId" element={<ReplayPage />} />
                <Route path="/user/:username" element={<UserPage />} />
                <Route path="/solo" element={<SoloMode />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/invite/:uuid" element={<Invite />} />
                <Route path="/together" element={<Together />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/password_reset/:token" element={<CreateNewPassword />} />
                <Route path="/password_reset" element={<PasswordResetPage />} />
                <Route path="*" element={<ErrorPage message="This page does not exist." />} />
            </Routes>
        </BrowserRouter>
    );
}