from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem, OrderStatus
from app.schemas.order import OrderCreate

ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PROCESSING, OrderStatus.CANCELLED},
    OrderStatus.PROCESSING: {OrderStatus.SHIPPED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


class OrderNotFoundError(Exception):
    pass


class InvalidOrderTransitionError(Exception):
    pass


def create_order(db: Session, order_data: OrderCreate) -> Order:
    total = sum(
        (item.unit_price * item.quantity for item in order_data.items),
        start=Decimal("0"),
    )
    order = Order(
        customer_id=order_data.customer_id,
        total_amount=total,
        currency=order_data.currency,
        status=OrderStatus.PENDING,
        items=[
            OrderItem(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in order_data.items
        ],
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def get_order(db: Session, order_id: int) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise OrderNotFoundError
    return order


def list_orders(
    db: Session, *, offset: int, limit: int, status: OrderStatus | None = None
) -> list[Order]:
    statement = select(Order).order_by(Order.created_at.desc(), Order.id.desc())
    if status is not None:
        statement = statement.where(Order.status == status)
    return list(db.scalars(statement.offset(offset).limit(limit)).all())


def list_customer_orders(
    db: Session, *, customer_id: int, offset: int, limit: int
) -> list[Order]:
    statement = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def update_order_status(
    db: Session, *, order_id: int, new_status: OrderStatus
) -> Order:
    order = get_order(db, order_id)
    if new_status not in ALLOWED_TRANSITIONS[order.status]:
        raise InvalidOrderTransitionError(
            f"Transition from '{order.status.value}' to '{new_status.value}' is not allowed"
        )
    order.status = new_status
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int) -> Order:
    return update_order_status(
        db, order_id=order_id, new_status=OrderStatus.CANCELLED
    )


def confirm_payment(db: Session, *, order_id: int) -> Order:
    order = get_order(db, order_id)
    if order.status == OrderStatus.CONFIRMED:
        return order
    return update_order_status(
        db, order_id=order_id, new_status=OrderStatus.CONFIRMED
    )
