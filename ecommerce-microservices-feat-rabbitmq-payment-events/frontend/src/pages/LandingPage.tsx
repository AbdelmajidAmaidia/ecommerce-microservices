import { ArrowRight, BarChart3, LockKeyhole, Package, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/ui";

export function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-black text-white">e</span>
          <span className="font-bold tracking-tight text-ink">E-commerce <span className="font-medium text-muted">Microservices</span></span>
        </Link>
        <Button onClick={() => login()}>Se connecter <ArrowRight className="h-4 w-4" /></Button>
      </header>

      <main>
        <section className="hero-grid relative">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-brand shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />Plateforme de gestion
              </span>
              <h1 className="mt-7 max-w-2xl text-5xl font-bold leading-[1.06] tracking-tight text-ink sm:text-6xl">
                Une expérience claire, du panier au <span className="text-brand">paiement.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
                Retrouvez vos opérations e-commerce dans un espace unique, sécurisé par Keycloak et connecté à l’API Gateway.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button onClick={() => login()} className="px-5 py-3">
                  Accéder à mon espace <ArrowRight className="h-4 w-4" />
                </Button>
                <a href="#fonctionnalites" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-slate-50">
                  Découvrir la plateforme
                </a>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted">
                <LockKeyhole className="h-4 w-4 text-emerald-600" />Authentification centralisée via OpenID Connect + PKCE
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-blue-100 via-indigo-50 to-white blur-2xl" />
              <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-[0_35px_90px_rgba(27,61,115,0.18)] sm:p-7">
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Espace de travail</p>
                    <p className="mt-1 text-lg font-bold text-ink">Vue d’ensemble</p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand"><BarChart3 className="h-5 w-5" /></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <Package className="h-5 w-5 text-brand" />
                    <p className="mt-5 text-sm font-semibold text-ink">Commandes</p>
                    <p className="mt-1 text-xs text-muted">Suivi des statuts réels</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50/70 p-4">
                    <WalletCards className="h-5 w-5 text-indigo-600" />
                    <p className="mt-5 text-sm font-semibold text-ink">Paiements</p>
                    <p className="mt-1 text-xs text-muted">Transactions simulées</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">Sécurité du compte</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Protégé</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">Les jetons restent en mémoire et sont renouvelés par l’adaptateur Keycloak.</p>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-navy px-4 py-3 text-white">
                  <LockKeyhole className="h-4 w-4 text-blue-200" />
                  <span className="text-xs font-medium">Une seule connexion pour accéder aux services</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-blue-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Un espace unifié</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">Les opérations essentielles, sans détour.</h2>
            <p className="mt-3 leading-7 text-muted">Les données affichées sont récupérées depuis les services métier via la Gateway. Aucun accès direct aux bases de données ou à RabbitMQ.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: Package, title: "Commandes", text: "Création et suivi de commandes à partir du contrat réel du service Order." },
              { icon: WalletCards, title: "Paiements", text: "Paiements de démonstration uniquement, sans données bancaires réelles." },
              { icon: LockKeyhole, title: "Accès sécurisé", text: "Connexion déléguée à Keycloak avec PKCE et contrôles de rôles." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-4 font-bold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-100 px-5 py-6 text-center text-xs text-muted">E-commerce Microservices · Projet académique</footer>
    </div>
  );
}
