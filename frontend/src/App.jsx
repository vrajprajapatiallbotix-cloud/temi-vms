import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import useAuthStore from './store/authStore';

import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/employee/Dashboard';
import NewVisit from './pages/employee/NewVisit';
import VisitApprovals from './pages/employee/VisitApprovals';
import AdminDashboard from './pages/admin/AdminDashboard';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import VisitorLogs from './pages/admin/VisitorLogs';
import TemiRobotPage from './pages/admin/TemiRobotPage';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import VisitorForm from './pages/visitor/VisitorForm';
import ImpromptuForm from './pages/visitor/ImpromptuForm';
import QRPage from './pages/visitor/QRPage';
import KioskPage from './pages/KioskPage';

let socket;

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

export default function App() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      socket = io(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true });
      socket.emit('join', { userId: user.id, role: user.role });
      return () => socket.disconnect();
    }
  }, [user]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/visitor/register/:token" element={<VisitorForm />} />
        <Route path="/visitor/impromptu" element={<ImpromptuForm />} />
        <Route path="/visitor/qr/:visitId" element={<QRPage />} />

        {/* Employee */}
        <Route path="/dashboard" element={
          <ProtectedRoute roles={['employee', 'admin']}>
            <EmployeeDashboard socket={socket} />
          </ProtectedRoute>
        } />
        <Route path="/visits/new" element={
          <ProtectedRoute roles={['employee', 'admin']}>
            <NewVisit />
          </ProtectedRoute>
        } />
        <Route path="/visits/approvals" element={
          <ProtectedRoute roles={['employee', 'admin']}>
            <VisitApprovals socket={socket} />
          </ProtectedRoute>
        } />

        {/* Platform Super Admin */}
        <Route path="/platform" element={
          <ProtectedRoute roles={['platform_super_admin']}>
            <PlatformDashboard />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/employees" element={
          <ProtectedRoute roles={['admin']}>
            <EmployeeManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/logs" element={
          <ProtectedRoute roles={['admin']}>
            <VisitorLogs />
          </ProtectedRoute>
        } />
        <Route path="/admin/temi" element={
          <ProtectedRoute roles={['admin']}>
            <TemiRobotPage />
          </ProtectedRoute>
        } />

        {/* Redirects */}
        <Route path="/" element={
          user
            ? <Navigate to={
                user.role === 'platform_super_admin' ? '/platform'
                : ['admin','org_admin','org_super_admin'].includes(user.role) ? '/admin'
                : '/dashboard'
              } />
            : <Navigate to="/kiosk" />
        } />
        <Route path="/unauthorized" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
              <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
            </div>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
