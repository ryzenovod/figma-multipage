import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import BeforeInterviewPage from './pages/before-interview';
import CameraPage from './pages/camera';
import MicrophonePage from './pages/microphone';
import ScreenPage from './pages/screen';
import InterviewPage from './pages/interview';
import './styles/global.css';

import InterviewChatPage from './pages/chat'
import HelpPage from './pages/help';



const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <BeforeInterviewPage /> },
      { path: 'camera', element: <CameraPage /> },
      { path: 'microphone', element: <MicrophonePage /> },
      { path: 'screen', element: <ScreenPage /> },
      { path: 'interview', element: <InterviewPage /> },
      { path: 'chat', element: <InterviewChatPage /> },
      { path: 'help', element: <HelpPage /> },

    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
