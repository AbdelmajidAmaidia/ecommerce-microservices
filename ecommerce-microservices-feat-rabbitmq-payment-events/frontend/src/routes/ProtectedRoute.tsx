import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Loading, Notice } from "../components/ui";

export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { initialized, authenticated, roles: userRoles, apiAudienceOk, error, login, logout } = useAuth();
  const location = useLocation();

  if (!initialized) return <Loading label="Vérification de la session Keycloak…" />;
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <Notice tone="error">{error}</Notice>
        <button className="mt-4 text-sm font-semibold text-brand" onClick={() => login()}>Réessayer la connexion</button>
      </main>
    );
  }
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!apiAudienceOk) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <Notice tone="error">
          Le jeton Keycloak ne contient pas l’audience `ecommerce-api` requise par les API. Vérifiez le mapper Audience du client puis reconnectez-vous.
        </Notice>
        <Button className="mt-4" onClick={logout}>Se déconnecter</Button>
      </main>
    );
  }
  if (roles && !roles.some((role) => userRoles.includes(role))) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
