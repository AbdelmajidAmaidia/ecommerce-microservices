import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { api } from "../services/api";
import { OrdersPage } from "./OrdersPage";
import { PaymentsPage } from "./PaymentsPage";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ roles: ["admin"] }),
}));

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

afterEach(cleanup);

describe("order and payment forms", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
  });

  it("submits a single order line with the entered values and displays its total", async () => {
    const user = userEvent.setup();
    const order = {
      id: 1,
      customer_id: 9,
      currency: "TND",
      total_amount: "75.00",
      status: "pending" as const,
      items: [{ id: 1, product_id: "TEST-001", quantity: 3, unit_price: "25.00" }],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(api.post).mockResolvedValue({ data: order } as never);
    renderPage(<OrdersPage />);

    await user.click(screen.getByRole("button", { name: "Nouvelle commande" }));
    await user.type(screen.getByLabelText("Identifiant client"), "9");
    await user.clear(screen.getByLabelText("Devise"));
    await user.type(screen.getByLabelText("Devise"), "TND");
    await user.type(screen.getByLabelText("Code produit"), "TEST-001");
    await user.clear(screen.getByLabelText("Quantité"));
    await user.type(screen.getByLabelText("Quantité"), "3");
    await user.clear(screen.getByLabelText("Prix unitaire"));
    await user.type(screen.getByLabelText("Prix unitaire"), "25");
    await user.click(screen.getByRole("button", { name: "Créer la commande" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/orders", {
        customer_id: 9,
        currency: "TND",
        items: [{ product_id: "TEST-001", quantity: 3, unit_price: "25.00" }],
      });
    });
    expect(screen.getByText(/75,00\s*TND/)).toBeInTheDocument();
  });

  it("keeps an empty added order line invalid", async () => {
    const user = userEvent.setup();
    renderPage(<OrdersPage />);

    await user.click(screen.getByRole("button", { name: "Nouvelle commande" }));
    await user.type(screen.getByLabelText("Identifiant client"), "9");
    await user.type(screen.getByLabelText("Code produit"), "TEST-001");
    await user.type(screen.getByLabelText("Prix unitaire"), "25");
    await user.click(screen.getByRole("button", { name: "Ajouter un article" }));
    await user.click(screen.getByRole("button", { name: "Créer la commande" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("submits values from the shared fields in the payment form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValue({
      data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
    } as never);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: "payment-1",
        orderId: 12,
        amount: 75,
        currency: "TND",
        method: "CASH_ON_DELIVERY",
        status: "PENDING",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    } as never);
    renderPage(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: "Nouveau paiement" }));
    await user.type(screen.getByLabelText("Identifiant de commande"), "12");
    await user.selectOptions(screen.getByLabelText("Mode de démonstration"), "CASH_ON_DELIVERY");
    await user.click(screen.getByRole("button", { name: "Lancer la simulation" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/payments", expect.objectContaining({
        orderId: 12,
        method: "CASH_ON_DELIVERY",
      }));
    });
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(expect.objectContaining({
      idempotencyKey: expect.stringMatching(/^web-/),
    }));
  });
});