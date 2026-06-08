import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { initNative } from './native';
import Login from './employee/Login';
import EmployeeApp from './employee/EmployeeApp';

const router = createHashRouter([
  { path: '/', element: <Login /> },
  { path: '/app', element: <EmployeeApp /> },
]);

void initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
