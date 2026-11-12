import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, EmptyState, Field, Loading, Notice, PageHeading, SelectField, StatusBadge } from "../components/ui";
import { api } from "../services/api";
import type { CreateOrderRequest, Order, OrderStatus } from "../types/api";
import { getErrorMessage } from "../utils/errors";
import { formatMoney, nextOrderStatuses, orderStatusLabel } from "../utils/status";

const orderFormSchema = z.object({
  customer_id: z.number().int().positive("L’identifiant client doit être positif."),
  currency: z.string().regex(/^[A-Z]{3}$/, "Utilisez un code devise à trois lettres majuscules."),
  items: z.array(z.object({
    product_id: z.string().trim().min(1, "Le code produit est obligatoire.").max(100),
    quantity: z.number().int().min(1, "La quantité minimale est 1.").max(100000),
    unit_price: z.number().positive("Le prix doit être supérieur à zéro.").max(9999999999.99),
  })).min(1, "Ajoutez au moins un article.").max(100),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

function OrderForm({ onClose, onCreated }: { onClose: () => void; onCreated: (order: Order) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { currency: "TND", items: [{ product_id: "", quantity: 1, unit_price: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const submit = async (values: OrderFormValues) => {
    const request: CreateOrderRequest = {
      customer_id: values.customer_id,
      currency: values.currency,
      items: values.items.map((item) => ({ ...item, unit_price: item.unit_price.toFixed(2) })),
    };
    setSubmitError(null);
    try {
      const response = await api.post<Order>("/orders", request);
      onCreated(response.data);
    } catch (reason) {
      setSubmitError(getErrorMessage(reason));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="create-order-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Nouvelle commande</p>
            <h2 id="create-order-title" className="mt-1 text-xl font-bold text-ink">Créer une commande</h2>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-slate-100">×</button>
        </div>
        <div className="mt-4"><Notice tone="warning">Les prix sont transmis par le client pour cette démonstration. Ne saisissez pas de données sensibles.</Notice></div>
        {submitError && <div className="mt-4"><Notice tone="error">{submitError}</Notice></div>}
        <form className="mt-5 space-y-5" onSubmit={(event) => void handleSubmit(submit)(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="customer_id" type="number" min="1" label="Identifiant client" error={errors.customer_id?.message} {...register("customer_id", { valueAsNumber: true })} />
            <Field id="currency" label="Devise" maxLength={3} error={errors.currency?.message} {...register("currency")} />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Articles</h3>
              <Button type="button" variant="secondary" onClick={() => append({ product_id: "", quantity: 1, unit_price: 0 })}><Plus className="h-4 w-4" />Ajouter un article</Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid items-end gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.4fr_0.7fr_0.9fr_auto]">
                  <Field id={`items.${index}.product_id`} label="Code produit" error={errors.items?.[index]?.product_id?.message} {...register(`items.${index}.product_id`)} />
                  <Field id={`items.${index}.quantity`} type="number" min="1" label="Quantité" error={errors.items?.[index]?.quantity?.message} {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                  <Field id={`items.${index}.unit_price`} type="number" min="0.01" step="0.01" label="Prix unitaire" error={errors.items?.[index]?.unit_price?.message} {...register(`items.${index}.unit_price`, { valueAsNumber: true })} />
                  <Button type="button" variant="ghost" aria-label={`Supprimer l’article ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            {errors.items?.message && <p className="mt-2 text-xs text-red-700">{errors.items.message}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Création…" : "Créer la commande"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function OrdersPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    setError(null);
    api.get<Order[]>("/orders", { params: { offset: 0, limit: 100 } })
      .then(({ data }) => active && setOrders(data))
      .catch((reason: unknown) => active && setError(getErrorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isAdmin, refresh]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const matchesQuery = `${order.id} ${order.customer_id}`.includes(query.trim());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [orders, query, statusFilter]);

  const updateOrder = async (id: number, status: OrderStatus) => {
    setError(null);
    try {
      const { data } = await api.patch<Order>(`/orders/${id}/status`, { status });
      setOrders((current) => current.map((order) => order.id === id ? data : order));
      setFeedback(`La commande #${id} est maintenant « ${orderStatusLabel(data.status)} ».`);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  };

  const cancelOrder = async (id: number) => {
    if (!window.confirm(`Confirmer l’annulation de la commande #${id} ?`)) return;
    setError(null);
    try {
      const { data } = await api.post<Order>(`/orders/${id}/cancel`);
      setOrders((current) => current.map((order) => order.id === id ? data : order));
      setFeedback(`La commande #${id} a été annulée.`);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeading eyebrow="Espace client" title="Commandes" description="Consultez et suivez les commandes auxquelles vous avez accès." />
        <Notice tone="warning">La réponse de l’API ne peut pas garantir qu’une commande appartient à votre compte Keycloak. Pour éviter d’exposer les commandes d’autres clients, cette liste est réservée à l’administration jusqu’à l’ajout d’un filtrage propriétaire vérifié côté backend.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Gestion des commandes"
        title="Commandes"
        description="Données réelles retournées par Order Service. La vue charge au plus 100 commandes."
        action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Nouvelle commande</Button>}
      />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {feedback && <div className="mb-4"><Notice tone="success">{feedback}</Notice></div>}
      {orders.length === 100 && <div className="mb-4"><Notice tone="info">La liste est limitée aux 100 premiers résultats. Le contrat actuel ne fournit pas de total pour cette API.</Notice></div>}
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-3">
            <label className="relative min-w-52 flex-1">
              <span className="sr-only">Rechercher une commande</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="field-control pl-9" placeholder="N° commande ou client" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className="field-control min-w-44" aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tous les statuts</option>
              {(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as OrderStatus[]).map((status) => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}
            </select>
          </div>
          <Button variant="ghost" onClick={() => setRefresh((value) => value + 1)} aria-label="Actualiser les commandes"><RefreshCw className="h-4 w-4" />Actualiser</Button>
        </div>

        {loading ? <Loading label="Chargement des commandes…" /> : visibleOrders.length === 0 ? (
          <EmptyState title={orders.length ? "Aucun résultat" : "Aucune commande retournée"}>Modifiez les filtres ou créez une commande pour commencer.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-muted"><th className="pb-3 pl-2">Commande</th><th className="pb-3">Client</th><th className="pb-3">Montant</th><th className="pb-3">Statut</th><th className="pb-3">Créée le</th><th className="pb-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80">
                    <td className="py-4 pl-2 font-semibold text-ink"><Link className="hover:text-brand" to={`/orders/${order.id}`}>#{order.id}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></td>
                    <td className="py-4 text-slate-600">#{order.customer_id}</td>
                    <td className="py-4 font-medium text-ink">{formatMoney(order.total_amount, order.currency)}</td>
                    <td className="py-4"><StatusBadge status={order.status} /></td>
                    <td className="py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1">
                        {nextOrderStatuses(order.status).map((nextStatus) => (
                          <button key={nextStatus} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-blue-50" onClick={() => void updateOrder(order.id, nextStatus)}>{orderStatusLabel(nextStatus)}</button>
                        ))}
                        {["pending", "confirmed"].includes(order.status) && <button className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => void cancelOrder(order.id)}>Annuler</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {showForm && (
        <OrderForm
          onClose={() => setShowForm(false)}
          onCreated={(order) => {
            setOrders((current) => [order, ...current]);
            setShowForm(false);
            setFeedback(`Commande #${order.id} créée.`);
          }}
        />
      )}
    </>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roles.includes("admin") || !id || !/^[1-9]\d*$/.test(id)) return;
    let active = true;
    setLoading(true);
    api.get<Order>(`/orders/${id}`)
      .then(({ data }) => active && setOrder(data))
      .catch((reason: unknown) => active && setError(getErrorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, roles]);

  if (!roles.includes("admin")) {
    return <><PageHeading title="Détail de commande" /><Notice tone="warning">La propriété des commandes n’est pas vérifiée par le backend. Les détails sont réservés au rôle administrateur.</Notice></>;
  }

  return (
    <>
      <button onClick={() => navigate("/orders")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Retour aux commandes</button>
      {loading && <Loading label="Chargement de la commande…" />}
      {error && <Notice tone="error">{error}</Notice>}
      {order && (
        <>
          <PageHeading eyebrow={`Commande #${order.id}`} title="Détail de la commande" action={<StatusBadge status={order.status} />} />
          <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
            <Card>
              <h2 className="font-bold text-ink">Articles</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                    <div><p className="font-semibold text-ink">{item.product_id}</p><p className="mt-1 text-xs text-muted">Quantité : {item.quantity}</p></div>
                    <p className="text-sm font-semibold text-ink">{formatMoney(Number(item.unit_price) * item.quantity, order.currency)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-4 font-bold text-ink"><span>Total</span><span>{formatMoney(order.total_amount, order.currency)}</span></div>
            </Card>
            <Card>
              <h2 className="font-bold text-ink">Informations</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div><dt className="text-muted">Identifiant client</dt><dd className="mt-1 font-semibold text-ink">#{order.customer_id}</dd></div>
                <div><dt className="text-muted">Créée le</dt><dd className="mt-1 font-semibold text-ink">{new Date(order.created_at).toLocaleString("fr-FR")}</dd></div>
                <div><dt className="text-muted">Dernière mise à jour</dt><dd className="mt-1 font-semibold text-ink">{new Date(order.updated_at).toLocaleString("fr-FR")}</dd></div>
              </dl>
            </Card>
          </div>
        </>
      )}
      {!loading && !error && !order && <Notice tone="error">Identifiant de commande invalide ou commande absente.</Notice>}
    </>
  );
}
