from decimal import Decimal


def create_payload() -> dict:
    return {
        "customer_id": 42,
        "currency": "TND",
        "items": [
            {"product_id": "book-1", "quantity": 2, "unit_price": "12.50"},
            {"product_id": "pen-2", "quantity": 3, "unit_price": "1.20"},
        ],
    }


def test_create_and_get_order(client):
    created = client.post("/api/orders", json=create_payload())

    assert created.status_code == 201
    order = created.json()
    assert order["customer_id"] == 42
    assert order["total_amount"] == "28.60"
    assert order["currency"] == "TND"
    assert order["status"] == "pending"
    assert len(order["items"]) == 2

    fetched = client.get(f"/api/orders/{order['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == order["id"]
    assert Decimal(fetched.json()["total_amount"]) == Decimal("28.60")
    assert set(fetched.json()) >= {
        "id",
        "total_amount",
        "currency",
        "status",
    }


def test_create_validates_quantity_price_and_currency(client):
    payload = create_payload()
    payload["items"][0]["quantity"] = 0
    assert client.post("/api/orders", json=payload).status_code == 422

    payload = create_payload()
    payload["items"][0]["unit_price"] = "-1.00"
    assert client.post("/api/orders", json=payload).status_code == 422

    payload = create_payload()
    payload["currency"] = "tn"
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_list_filters_and_paginates_orders(client):
    first = client.post("/api/orders", json=create_payload()).json()
    payload = create_payload()
    payload["customer_id"] = 43
    second = client.post("/api/orders", json=payload).json()
    client.patch(
        f"/api/orders/{first['id']}/status", json={"status": "confirmed"}
    )

    response = client.get("/api/orders", params={"status": "confirmed", "limit": 1})
    assert response.status_code == 200
    assert [order["id"] for order in response.json()] == [first["id"]]

    customer_orders = client.get("/api/orders/customer/43")
    assert [order["id"] for order in customer_orders.json()] == [second["id"]]


def test_status_transition_validation_and_cancellation(client):
    created = client.post("/api/orders", json=create_payload()).json()
    order_id = created["id"]

    cancelled = client.post(f"/api/orders/{order_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    invalid = client.patch(
        f"/api/orders/{order_id}/status", json={"status": "confirmed"}
    )
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "invalid_order_transition"

    another = client.post("/api/orders", json=create_payload()).json()
    confirmed = client.patch(
        f"/api/orders/{another['id']}/status", json={"status": "confirmed"}
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"


def test_missing_order_and_invalid_request_errors_are_consistent(client):
    missing = client.get("/api/orders/999")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "order_not_found"

    invalid_status = client.patch(
        "/api/orders/999/status", json={"status": "unknown"}
    )
    assert invalid_status.status_code == 422
    assert invalid_status.json()["error"]["code"] == "validation_error"

    assert client.get("/health").json() == {"status": "ok"}
