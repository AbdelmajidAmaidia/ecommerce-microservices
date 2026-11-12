import { LayoutDashboard, LogOut, Package, Shield, UserRound, WalletCards } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    isActive ? "bg-blue-50 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
  }`;

export function AppShell() {
  const { claims, roles, logout } = useAuth();
  const isAdmin = roles.includes("admin");
  const displayName = claims?.name || claims?.preferred_username || claims?.email || "Compte connecté";

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <NavLink to="/" className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-black text-white">e</span>
          <span>
            <span className="block font-bold tracking-tight text-ink">E-commerce</span>
            <span className="block text-xs text-muted">Microservices</span>
          </span>
        </NavLink>
        <div className="mt-10">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Espace</p>
          <nav aria-label="Navigation principale" className="space-y-1">
            <NavLink to="/dashboard" className={navClass}><LayoutDashboard className="h-4 w-4" />Vue d'ensemble</NavLink>
            <NavLink to="/orders" className={navClass}><Package className="h-4 w-4" />Commandes</NavLink>
            <NavLink to="/payments" className={navClass}><WalletCards className="h-4 w-4" />Paiements</NavLink>
            {isAdmin && <NavLink to="/admin" className={navClass}><Shield className="h-4 w-4" />Administration</NavLink>}
            <NavLink to="/profile" className={navClass}><UserRound className="h-4 w-4" />Mon profil</NavLink>
          </nav>
        </div>
        <div className="mt-auto rounded-2xl bg-slate-50 p-4">
          <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
          <p className="mt-1 text-xs capitalize text-muted">{isAdmin ? "Administrateur" : "Utilisateur"}</p>
          <button onClick={logout} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-red-700">
            <LogOut className="h-4 w-4" />Se déconnecter
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-9">
            <NavLink to="/dashboard" className="flex items-center gap-2 font-bold text-ink lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white">e</span>E-commerce
            </NavLink>
            <p className="hidden text-sm text-muted lg:block">Espace de gestion sécurisé</p>
            <div className="flex items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm font-medium text-ink sm:block">{displayName}</span>
              <button onClick={logout} aria-label="Se déconnecter" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink lg:hidden">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav aria-label="Navigation mobile" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden">
            <NavLink to="/dashboard" className={navClass}><LayoutDashboard className="h-4 w-4" />Accueil</NavLink>
            <NavLink to="/orders" className={navClass}><Package className="h-4 w-4" />Commandes</NavLink>
            <NavLink to="/payments" className={navClass}><WalletCards className="h-4 w-4" />Paiements</NavLink>
            {isAdmin && <NavLink to="/admin" className={navClass}><Shield className="h-4 w-4" />Admin</NavLink>}
            <NavLink to="/profile" className={navClass}><UserRound className="h-4 w-4" />Profil</NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
