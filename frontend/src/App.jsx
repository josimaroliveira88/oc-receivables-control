import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import PeoplePage from './pages/PeoplePage';
import OrdersPage from './pages/OrdersPage';
import ReceivablesPage from './pages/ReceivablesPage';
import ProductsPage from './pages/ProductsPage';
import ToastProvider from './components/Toast';
import Header from './components/Header';
import MobileDrawer from './components/MobileDrawer';
import OnboardingTour from './components/OnboardingTour';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-6 pb-6">
        <Outlet />
      </main>
      <MobileDrawer />
      <OnboardingTour />
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
          <Route path="/products" element={<ProductsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
