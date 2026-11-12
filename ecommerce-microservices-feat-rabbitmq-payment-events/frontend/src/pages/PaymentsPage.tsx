import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, EmptyState, Field, Loading, Notice, PageHeading, SelectField, StatusBadge } from "../components/ui";
import { api } from "../services/api";
import type { CreatePaymentRequest, Order, Payment, PaymentMethod, PaymentPage, PaymentStatus } from "../types/api";
import { getErrorMessage } from "../utils/errors";
import { formatMoney } from "../utils/status";

const paymentSchema = z.object({
  orderId: z.number().int().positive("L’identifiant de commande doit être positif."),
  method: z.enum(["SIMULATED_CARD", "CASH_ON_DELIVERY"]),
  idempotencyKey: z.string().trim().min(1, "La clé d’idempotence est obligatoire.").max(100),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `web-${crypto.randomUUID()}`
    : `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function PaymentForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (payment: Payment) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { orderId: undefined, method: "SIMULATED_CARD", idempotencyKey: newIdempotencyKey() },
  });

  const submit = async (values: PaymentFormValues) => {
    const request: CreatePaymentRequest = { ...values };
    setSubmitError(null);
    try {
      const response = await api.post<Payment>("/payments", request);
      onCreated(response.data);
    } catch (reason) {
      setSubmitError(getErrorMessage(reason));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="create-payment-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-brand">Paiement simulé</p><h2 id="create-payment-title" className="mt-1 text-xl font-bold text-ink">Créer une tentative</h2></div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-slate-100">×</button>
        </div>
        <div className="mt-4"><Notice tone="warning">Aucune carte bancaire réelle n’est demandée. Le montant et la devise sont relus depuis Order Service.</Notice></div>
        {submitError && <div className="mt-4"><Notice tone="error">{submitError}</Notice></div>}
        <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(submit)(event)}>
          <Field id="orderId" label="Identifiant de commande" type="number" min="1" error={errors.orderId?.message} {...register("orderId", { valueAsNumber: true })} />
          <SelectField id="method" label="Mode de démonstration" error={errors.method?.message} {...register("method")}>
            <option value="SIMULATED_CARD">Carte simulée</option>
            <option value="CASH_ON_DELIVERY">Paiement à la livraison</option>
          </SelectField>
          <Field id="idempotencyKey" label="Clé d’idempotence" error={errors.idempotencyKey?.message} {...register("idempotencyKey")} />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Envoi…" : "Lancer la simulation"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PaymentsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [orderId, setOrderId] = useState("");
  const [payments, setPayments] = useState<PaymentPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: "info" | "success" } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = { page, size: 10 };
    if (status !== "all") params.status = status;
    if (orderId.trim()) params.orderId = Number(orderId);
    api.get<PaymentPage>("/payments", { params })
      .then(({ data }) => active && setPayments(data))
      .catch((reason: unknown) => active && setError(getErrorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isAdmin, page, status, orderId, refresh]);

  const pollOrderAfterPayment = async (payment: Payment) => {
    if (payment.status !== "SUCCEEDED") return;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      try {
        const { data } = await api.get<Order>(`/orders/${payment.orderId}`);
        if (data.status !== "pending") {
          setFeedback({ tone: "success", text: `Paiement réussi. La commande #${payment.orderId} est maintenant « ${data.status} » après traitement de l’événement.` });
          return;
        }
      } catch {
        setFeedback({ tone: "info", text: "Paiement enregistré. Impossible de confirmer l’actualisation de la commande ; vérifiez-la à nouveau dans quelques instants." });
        return;
      }
    }
    setFeedback({ tone: "info", text: `Paiement réussi. La commande #${payment.orderId} est encore en attente ; le worker peut traiter l’événement un peu plus tard.` });
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeading eyebrow="Espace client" title="Paiements" description="Consultez et suivez les paiements liés à vos commandes." />
        <Notice tone="warning">L’API actuelle renvoie une liste globale sans filtrage propriétaire vérifié. Les paiements ne sont donc pas exposés aux utilisateurs standards. Lancer un paiement nécessitera aussi une vérification backend que la commande appartient au sujet Keycloak.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeading eyebrow="Gestion des paiements" title="Paiements" description="Historique paginé renvoyé par Payment Service. Les opérations sont simulées." action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" />Nouveau paiement</Button>} />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {feedback && <div className="mb-4"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}
      <Card>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">N° de commande</span>
              <input className="field-control min-w-44" type="number" min="1" value={orderId} onChange={(event) => { setOrderId(event.target.value); setPage(0); }} placeholder="Toutes les commandes" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Statut</span>
              <select className="field-control min-w-44" value={status} onChange={(event) => { setStatus(event.target.value as PaymentStatus | "all"); setPage(0); }}>
                <option value="all">Tous les statuts</option><option value="PENDING">En attente</option><option value="SUCCEEDED">Réussi</option><option value="FAILED">Échoué</option>
              </select>
            </label>
          </div>
          <Button variant="ghost" onClick={() => setRefresh((value) => value + 1)} aria-label="Actualiser les paiements"><RefreshCw className="h-4 w-4" />Actualiser</Button>
        </div>

        {loading ? <Loading label="Chargement des paiements…" /> : !payments?.content.length ? (
          <EmptyState title="Aucun paiement trouvé">Modifiez les filtres ou créez une tentative de paiement simulée.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[690px] text-left text-sm">
                <thead><tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-muted"><th className="pb-3 pl-2">Paiement</th><th className="pb-3">Commande</th><th className="pb-3">Montant</th><th className="pb-3">Méthode</th><th className="pb-3">Statut</th><th className="pb-3">Date</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.content.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/80">
                      <td className="py-4 pl-2 font-semibold text-ink"><Link className="hover:text-brand" to={`/payments/${payment.id}`}>{payment.id.slice(0, 10)}…<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link></td>
                      <td className="py-4 text-slate-600">#{payment.orderId}</td>
                      <td className="py-4 font-medium text-ink">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="py-4 text-slate-600">{payment.method === "SIMULATED_CARD" ? "Carte simulée" : "À la livraison"}</td>
                      <td className="py-4"><StatusBadge status={payment.status} /></td>
                      <td className="py-4 text-slate-500">{new Date(payment.createdAt).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-muted">{payments.totalElements} résultat(s) · Page {payments.number + 1} sur {Math.max(payments.totalPages, 1)}</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" />Précédente</Button>
                <Button variant="secondary" disabled={page + 1 >= payments.totalPages} onClick={() => setPage((value) => value + 1)}>Suivante<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
      {showForm && (
        <PaymentForm
          onClose={() => setShowForm(false)}
          onCreated={(payment) => {
            setShowForm(false);
            setPage(0);
            setStatus("all");
            setOrderId("");
            setRefresh((value) => value + 1);
            setFeedback({ tone: "success", text: `Tentative #${payment.id} enregistrée avec le statut ${payment.status}.` });
            void pollOrderAfterPayment(payment);
          }}
        />
      )}
    </>
  );
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!roles.includes("admin") || !id || !/^[a-fA-F0-9]{24}$/.test(id)) return;
    let active = true;
    setLoading(true);
    api.get<Payment>(`/payments/${id}`)
      .then(({ data }) => active && setPayment(data))
      .catch((reason: unknown) => active && setError(getErrorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, roles]);

  const updatePayment = async (status: "SUCCEEDED" | "FAILED") => {
    if (!payment || !window.confirm(`Confirmer le passage du paiement au statut ${status} ?`)) return;
    try {
      const { data } = await api.patch<Payment>(`/payments/${payment.id}/status`, { status });
      setPayment(data);
      setFeedback(`Le paiement est maintenant ${data.status}.`);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  };

  if (!roles.includes("admin")) {
    return <><PageHeading title="Détail du paiement" /><Notice tone="warning">Le backend ne vérifie pas l’appartenance d’un paiement à l’utilisateur courant. Le détail est réservé à l’administration.</Notice></>;
  }

  return (
    <>
      <button onClick={() => navigate("/payments")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Retour aux paiements</button>
      {loading && <Loading label="Chargement du paiement…" />}
      {error && <Notice tone="error">{error}</Notice>}
      {feedback && <div className="mt-4"><Notice tone="success">{feedback}</Notice></div>}
      {payment && (
        <>
          <PageHeading eyebrow={`Paiement ${payment.id}`} title="Détail du paiement" action={<StatusBadge status={payment.status} />} />
          <Card className="max-w-2xl">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Commande</dt><dd className="mt-1 font-semibold text-ink">#{payment.orderId}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Montant</dt><dd className="mt-1 font-semibold text-ink">{formatMoney(payment.amount, payment.currency)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Méthode</dt><dd className="mt-1 font-semibold text-ink">{payment.method === "SIMULATED_CARD" ? "Carte simulée" : "Paiement à la livraison"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Créé le</dt><dd className="mt-1 font-semibold text-ink">{new Date(payment.createdAt).toLocaleString("fr-FR")}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">Mis à jour le</dt><dd className="mt-1 font-semibold text-ink">{new Date(payment.updatedAt).toLocaleString("fr-FR")}</dd></div>
            </dl>
            {payment.status === "PENDING" && <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5"><Button onClick={() => void updatePayment("SUCCEEDED")}>Marquer réussi</Button><Button variant="danger" onClick={() => void updatePayment("FAILED")}>Marquer échoué</Button></div>}
          </Card>
        </>
      )}
      {!loading && !error && !payment && <Notice tone="error">Identifiant invalide ou paiement introuvable.</Notice>}
    </>
  );
}
