import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Homepage';
import Lobby from './components/Lobby';
import { ReplayPage } from './components/Replay';
import UserPage from './components/UserPage';
import SoloMode from './components/SoloMode';
import Profile from './components/Profile';
import Invite from './components/Invite';
import ErrorPage from './components/ErrorPage';
import Together, { TogetherJoin } from './components/Together';
import Leaderboard from './components/Leaderboard';

export default function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lobby/:lobby_id" element={<Lobby />} />
                <Route path="/replay/:solveId" element={<ReplayPage />} />
                <Route path="/user/:username" element={<UserPage />} />
                <Route path="/solo" element={<SoloMode />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/invite/:uuid" element={<Invite />} />
                <Route path="/together" element={<Together />} />
                <Route path="/together/:uuid" element={<TogetherJoin />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="*" element={<ErrorPage message="This page does not exist." />} />
            </Routes>
        </BrowserRouter>
    );
}