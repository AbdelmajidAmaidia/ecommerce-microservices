import { useEffect, useState } from "react";
import { ArrowRight, CircleDollarSign, Package, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Loading, Notice, PageHeading, StatCard } from "../components/ui";
import { api } from "../services/api";
import type { Order, PaymentPage } from "../types/api";
import { getErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/status";

interface DashboardData {
  orders: Order[];
  payments: PaymentPage;
}

export function DashboardPage({ adminView = false }: { adminView?: boolean }) {
  const { claims, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<Order[]>("/orders", { params: { offset: 0, limit: 100 } }),
      api.get<PaymentPage>("/payments", { params: { page: 0, size: 20 } }),
    ])
      .then(([orders, payments]) => {
        if (active) setData({ orders: orders.data, payments: payments.data });
      })
      .catch((reason: unknown) => active && setError(getErrorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isAdmin]);

  const displayName = claims?.name || claims?.preferred_username || "Bienvenue";
  const title = adminView ? "Administration" : "Vue d’ensemble";

  return (
    <>
      <PageHeading
        eyebrow={adminView ? "Espace administrateur" : "Votre espace"}
        title={`${title}, ${displayName}`}
        description={adminView ? "Indicateurs calculés à partir des réponses réelles des API." : "Retrouvez ici les informations et raccourcis correspondant à votre compte."}
      />
      {loading && <Loading label="Récupération des indicateurs…" />}
      {error && <Notice tone="error">{error}</Notice>}
      {isAdmin && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Commandes chargées" value={data.orders.length} note={data.orders.length === 100 ? "100 résultats affichés au maximum par cette vue" : "Résultats renvoyés par Order Service"} icon={<Package className="h-5 w-5" />} />
            <StatCard label="Paiements enregistrés" value={data.payments.totalElements} note={`Page ${data.payments.number + 1} sur ${Math.max(data.payments.totalPages, 1)} renvoyée par Payment Service`} icon={<WalletCards className="h-5 w-5" />} />
            <StatCard label="Montants sur la page courante" value={formatMoney(data.payments.content.reduce((total, payment) => total + payment.amount, 0), data.payments.content[0]?.currency || "TND")} note="Somme des paiements affichés, pas un total global" icon={<CircleDollarSign className="h-5 w-5" />} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="font-bold text-ink">Commandes récentes</h2><p className="mt-1 text-sm text-muted">Données de Order Service</p></div>
                <Link to="/orders" className="text-sm font-semibold text-brand hover:text-brand-dark">Tout voir <ArrowRight className="inline h-4 w-4" /></Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.orders.slice(0, 4).map((order) => (
                  <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 hover:bg-blue-50">
                    <span className="text-sm font-semibold text-ink">Commande #{order.id}</span>
                    <span className="text-xs capitalize text-muted">{order.status}</span>
                  </Link>
                ))}
                {data.orders.length === 0 && <p className="text-sm text-muted">Aucune commande retournée.</p>}
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="font-bold text-ink">Paiements récents</h2><p className="mt-1 text-sm text-muted">Page courante de Payment Service</p></div>
                <Link to="/payments" className="text-sm font-semibold text-brand hover:text-brand-dark">Tout voir <ArrowRight className="inline h-4 w-4" /></Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.payments.content.slice(0, 4).map((payment) => (
                  <Link key={payment.id} to={`/payments/${payment.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 hover:bg-blue-50">
                    <span className="text-sm font-semibold text-ink">Commande #{payment.orderId}</span>
                    <span className="text-xs text-muted">{payment.status}</span>
                  </Link>
                ))}
                {data.payments.content.length === 0 && <p className="text-sm text-muted">Aucun paiement sur cette page.</p>}
              </div>
            </Card>
          </div>
        </>
      )}
      {!isAdmin && (
        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-white to-blue-50/60">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-100 text-brand"><ShieldCheck className="h-6 w-6" /></div>
              <div>
                <h2 className="font-bold text-ink">Bonjour {displayName}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Votre session est authentifiée par Keycloak. Pour protéger les données des autres clients, les listes globales de commandes et de paiements ne sont pas affichées aux utilisateurs standards.</p>
              </div>
            </div>
          </Card>
          <Notice tone="warning">Le backend actuel ne relie pas de manière vérifiable le sujet Keycloak à `customer_id` et ne filtre pas les paiements par propriétaire. Une vue personnelle sécurisée nécessite ce contrôle côté backend ; fournir un identifiant client dans le navigateur ne suffit pas.</Notice>
          <div className="flex flex-wrap gap-3">
            <Link to="/orders"><Button variant="secondary">Voir les commandes <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/payments"><Button variant="secondary">Voir les paiements <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      )}
    </>
  );
}
