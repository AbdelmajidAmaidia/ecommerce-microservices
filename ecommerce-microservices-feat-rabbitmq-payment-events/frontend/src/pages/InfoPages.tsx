import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <section className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><ShieldAlert className="h-7 w-7" /></div>
        <p className="mt-5 text-sm font-bold uppercase tracking-widest text-brand">403 · Accès refusé</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Cette page n’est pas accessible</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Votre rôle Keycloak ne permet pas d’accéder à cette fonctionnalité.</p>
        <Link to="/dashboard"><Button className="mt-6"><ArrowLeft className="h-4 w-4" />Retour au tableau de bord</Button></Link>
      </section>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <section className="text-center">
        <p className="text-6xl font-black tracking-tight text-brand">404</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted">Cette adresse ne correspond à aucune page de l’application.</p>
        <Link to="/"><Button variant="secondary" className="mt-6"><ArrowLeft className="h-4 w-4" />Retour à l’accueil</Button></Link>
      </section>
    </main>
  );
}
