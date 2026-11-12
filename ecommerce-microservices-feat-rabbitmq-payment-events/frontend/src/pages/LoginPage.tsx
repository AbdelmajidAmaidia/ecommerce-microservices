import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Notice } from "../components/ui";

export function LoginPage() {
  const { login, initialized, error } = useAuth();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-card sm:p-9">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Retour à l’accueil</Link>
        <div className="mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-brand"><LockKeyhole className="h-6 w-6" /></div>
        <h1 className="mt-5 text-2xl font-bold text-ink">Connexion sécurisée</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Vous allez être redirigé vers Keycloak pour vous authentifier. Aucun mot de passe n’est saisi dans cette application.</p>
        {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}
        <Button className="mt-7 w-full" disabled={!initialized} onClick={error ? () => window.location.reload() : () => login(returnTo)}>
          {error ? "Réessayer l’initialisation" : "Continuer avec Keycloak"}
        </Button>
        {returnTo && <p className="mt-4 text-center text-xs text-muted">Après connexion, reprenez votre navigation.</p>}
      </section>
    </main>
  );
}
