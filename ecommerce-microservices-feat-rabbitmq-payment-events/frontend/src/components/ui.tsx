import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, PackageOpen } from "lucide-react";
import type { OrderStatus, PaymentStatus } from "../types/api";
import { orderStatusLabel, paymentStatusLabel } from "../utils/status";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: PropsWithChildren<{ tone?: "info" | "error" | "success" | "warning" }>) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-medium text-muted" role="status">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-brand" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <PackageOpen aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6 ${className}`}>{children}</section>;
}

export function StatCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-brand">{icon}</div>
      </div>
    </Card>
  );
}

export function StatusBadge({ status }: { status: OrderStatus | PaymentStatus }) {
  const orderStatuses: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const isOrder = orderStatuses.includes(status as OrderStatus);
  const variants: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
    confirmed: "bg-blue-50 text-blue-800 ring-blue-200",
    processing: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    shipped: "bg-violet-50 text-violet-800 ring-violet-200",
    delivered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    SUCCEEDED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
    FAILED: "bg-red-50 text-red-800 ring-red-200",
  };
  const label = isOrder ? orderStatusLabel(status as OrderStatus) : paymentStatusLabel(status as PaymentStatus);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${variants[status]}`}>{label}</span>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-brand text-white shadow-sm hover:bg-brand-dark focus-visible:ring-brand",
    secondary: "border border-slate-200 bg-white text-ink hover:bg-slate-50 focus-visible:ring-brand",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink focus-visible:ring-brand",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; id: string }>(
  ({ label, error, id, className = "", ...props }, ref) => {
    return (
      <label className={`block ${className}`} htmlFor={id}>
        <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
        <input id={id} ref={ref} className="field-control" aria-invalid={Boolean(error)} {...props} />
        {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
      </label>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; id: string }>(
  ({ label, error, id, children, className = "", ...props }, ref) => {
    return (
      <label className={`block ${className}`} htmlFor={id}>
        <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
        <select id={id} ref={ref} className="field-control" aria-invalid={Boolean(error)} {...props}>
          {children}
        </select>
        {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
      </label>
    );
  },
);
