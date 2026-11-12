import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { Loading } from "./components/ui";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage, NotFoundPage } from "./pages/InfoPages";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { OrderDetailPage, OrdersPage } from "./pages/OrdersPage";
import { PaymentDetailPage, PaymentsPage } from "./pages/PaymentsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

function AppRoutes() {
  const { initialized, authenticated } = useAuth();
  if (!initialized) return <Loading label="Connexion sécurisée en cours…" />;

  return (
    <Routes>
      <Route path="/" element={authenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payments/:id" element={<PaymentDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/admin" element={<DashboardPage adminView />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
