import type { OrderStatus, PaymentStatus } from "../types/api";

const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  return allowedOrderTransitions[status];
}

export function orderStatusLabel(status: OrderStatus): string {
  return {
    pending: "En attente",
    confirmed: "Confirmée",
    processing: "En préparation",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
  }[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return {
    PENDING: "En attente",
    SUCCEEDED: "Réussi",
    FAILED: "Échoué",
  }[status];
}

export function formatMoney(amount: string | number, currency: string): string {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}
