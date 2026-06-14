import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import PeoplePage from './pages/PeoplePage';
import OrdersPage from './pages/OrdersPage';
import ReceivablesPage from './pages/ReceivablesPage';
import ToastProvider from './components/Toast';
import Header from './components/Header';
import MobileBottomNav from './components/MobileBottomNav';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/receivables" element={<ReceivablesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
