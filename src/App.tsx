import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav';
import Join from './pages/Join';
import User from './pages/User';
import About from './pages/About';
import Vision from './pages/Vision';
import Admin from './pages/Admin';
import PrivateRoom from './pages/PrivateRoom';
import NotFound from './pages/NotFound';
import SystemError from './pages/SystemError';

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<Join />} />
        <Route path="/user" element={<User />} />
        <Route path="/room/:roomId" element={<PrivateRoom />} />
        <Route path="/about" element={<About />} />
        <Route path="/vision" element={<Vision />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/error" element={<SystemError />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
