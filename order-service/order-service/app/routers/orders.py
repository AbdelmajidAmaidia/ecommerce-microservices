from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.order import OrderStatus
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate
from app.services.orders import (
    cancel_order,
    create_order,
    get_order,
    list_customer_orders,
    list_orders,
    update_order_status,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])
DatabaseSession = Annotated[Session, Depends(get_db)]
PositiveOrderId = Annotated[int, Path(gt=0)]


@router.post("", response_model=OrderRead, status_code=201)
def create_order_endpoint(order_data: OrderCreate, db: DatabaseSession) -> OrderRead:
    """Create an order. Submitted prices are for demonstration only."""
    return create_order(db, order_data)


@router.get("", response_model=list[OrderRead])
def list_orders_endpoint(
    db: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    status: OrderStatus | None = None,
) -> list[OrderRead]:
    return list_orders(db, offset=offset, limit=limit, status=status)


@router.get("/customer/{customer_id}", response_model=list[OrderRead])
def list_customer_orders_endpoint(
    customer_id: Annotated[int, Path(gt=0)],
    db: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[OrderRead]:
    return list_customer_orders(
        db, customer_id=customer_id, offset=offset, limit=limit
    )


@router.get("/{order_id}", response_model=OrderRead)
def get_order_endpoint(order_id: PositiveOrderId, db: DatabaseSession) -> OrderRead:
    """Return order details, including the payment-facing summary fields."""
    return get_order(db, order_id)


@router.patch("/{order_id}/status", response_model=OrderRead)
def update_order_status_endpoint(
    order_id: PositiveOrderId,
    status_update: OrderStatusUpdate,
    db: DatabaseSession,
) -> OrderRead:
    return update_order_status(
        db, order_id=order_id, new_status=status_update.status
    )


@router.post("/{order_id}/cancel", response_model=OrderRead)
def cancel_order_endpoint(order_id: PositiveOrderId, db: DatabaseSession) -> OrderRead:
    return cancel_order(db, order_id)
