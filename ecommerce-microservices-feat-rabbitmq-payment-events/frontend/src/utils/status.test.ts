import { describe, expect, it } from "vitest";
import { formatMoney, nextOrderStatuses, orderStatusLabel, paymentStatusLabel } from "./status";

describe("business status helpers", () => {
  it("uses only transitions defined by Order Service", () => {
    expect(nextOrderStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextOrderStatuses("shipped")).toEqual(["delivered"]);
    expect(nextOrderStatuses("delivered")).toEqual([]);
  });

  it("labels real order and payment statuses in French", () => {
    expect(orderStatusLabel("processing")).toBe("En préparation");
    expect(paymentStatusLabel("SUCCEEDED")).toBe("Réussi");
  });

  it("formats finite values and keeps malformed values visible", () => {
    expect(formatMoney(10, "TND")).toContain("10");
    expect(formatMoney("invalid", "TND")).toBe("invalid TND");
  });
});
