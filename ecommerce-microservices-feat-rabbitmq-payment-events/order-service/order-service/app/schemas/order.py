from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.order import OrderStatus

MAX_ORDER_AMOUNT = Decimal("9999999999.99")
PositiveCustomerId = Annotated[int, Field(gt=0)]
PositiveQuantity = Annotated[int, Field(gt=0, le=100000)]
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


class OrderItemCreate(BaseModel):
    product_id: str = Field(min_length=1, max_length=100)
    quantity: PositiveQuantity
    unit_price: Money


class OrderCreate(BaseModel):
    customer_id: PositiveCustomerId
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)
    currency: str = Field(default="TND", pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def validate_total_amount(self) -> "OrderCreate":
        total = sum(
            (item.unit_price * item.quantity for item in self.items), start=Decimal("0")
        )
        if total > MAX_ORDER_AMOUNT:
            raise ValueError("The calculated total exceeds the supported order amount")
        return self


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: str
    quantity: int
    unit_price: Decimal


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    items: list[OrderItemRead]
    total_amount: Decimal
    currency: str
    status: OrderStatus
    created_at: datetime
    updated_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
