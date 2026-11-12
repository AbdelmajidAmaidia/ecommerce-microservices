export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type PaymentMethod = "SIMULATED_CARD" | "CASH_ON_DELIVERY";

export interface OrderItem {
  id: number;
  product_id: string;
  quantity: number;
  unit_price: string;
}

export interface Order {
  id: number;
  customer_id: number;
  items: OrderItem[];
  total_amount: string;
  currency: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  customer_id: number;
  currency: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

export interface Payment {
  id: string;
  orderId: number;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPage {
  content: Payment[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CreatePaymentRequest {
  orderId: number;
  method: PaymentMethod;
  idempotencyKey: string;
}
