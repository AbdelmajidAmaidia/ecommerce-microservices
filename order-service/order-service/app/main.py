
import asyncio
import logging
import os
from collections.abc import Mapping
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from py_eureka_client.eureka_client import EurekaClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base, engine
from app.models.order import Order, OrderItem
from app.routers.orders import router as orders_router
from app.services.orders import (
    InvalidOrderTransitionError,
    OrderNotFoundError,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Créer les tables au démarrage uniquement si la base
    # n'est pas remplacée par une base de test.
    if not app.dependency_overrides:
        Base.metadata.create_all(bind=engine)

    eureka_client: EurekaClient | None = None
    registration_task: asyncio.Task[None] | None = None
    eureka_enabled = os.getenv("EUREKA_ENABLED", "true").strip().lower()

    if eureka_enabled not in {"false", "0", "no", "off"}:
        try:
            eureka_client = EurekaClient(
                eureka_server=os.getenv(
                    "EUREKA_SERVER", "http://localhost:8761/eureka/"
                ),
                app_name=os.getenv("EUREKA_APP_NAME", "order-service"),
                instance_host=os.getenv("EUREKA_INSTANCE_HOST", "127.0.0.1"),
                instance_port=int(os.getenv("EUREKA_INSTANCE_PORT", "8085")),
            )
            registration_task = asyncio.create_task(eureka_client.start())
            registration_task.add_done_callback(_log_eureka_startup_result)
        except Exception:
            logger.exception(
                "Could not initialize Eureka client; starting without registration"
            )

    try:
        yield
    finally:
        if eureka_client is not None:
            if registration_task is not None and not registration_task.done():
                registration_task.cancel()
                await asyncio.gather(registration_task, return_exceptions=True)

            try:
                await asyncio.wait_for(eureka_client.stop(), timeout=5)
            except Exception:
                logger.exception("Could not stop Eureka client cleanly")


def _log_eureka_startup_result(task: asyncio.Task[None]) -> None:
    try:
        task.result()
    except asyncio.CancelledError:
        return
    except Exception:
        logger.exception(
            "Eureka registration could not be started; "
            "Order Service will continue without Eureka"
        )
    else:
        logger.info("Eureka client startup completed")


app = FastAPI(
    title="Order Service",
    description=(
        "Service de démonstration pour les commandes e-commerce. "
        "Les prix transmis par le client doivent être vérifiés "
        "auprès du service Produits en production."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(orders_router)


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: object | None = None,
) -> JSONResponse:
    error: dict[str, object] = {
        "code": code,
        "message": message,
    }

    if details is not None:
        error["details"] = jsonable_encoder(details)

    return JSONResponse(
        status_code=status_code,
        content={"error": error},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    if isinstance(exc.detail, Mapping):
        code = str(exc.detail.get("code", "http_error"))
        message = str(exc.detail.get("message", "Request failed"))
        details = exc.detail.get("details")
    else:
        code = "http_error"
        message = str(exc.detail)
        details = None

    return error_response(
        exc.status_code,
        code,
        message,
        details,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return error_response(
        422,
        "validation_error",
        "Request validation failed",
        exc.errors(),
    )


@app.exception_handler(OrderNotFoundError)
async def order_not_found_handler(
    request: Request,
    exc: OrderNotFoundError,
) -> JSONResponse:
    return error_response(
        404,
        "order_not_found",
        "Order not found",
    )


@app.exception_handler(InvalidOrderTransitionError)
async def invalid_transition_handler(
    request: Request,
    exc: InvalidOrderTransitionError,
) -> JSONResponse:
    return error_response(
        400,
        "invalid_order_transition",
        str(exc),
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    logger.exception("Database operation failed")
    return error_response(
        500,
        "database_error",
        "A database operation failed",
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Unexpected request error")
    return error_response(
        500,
        "internal_server_error",
        "An unexpected error occurred",
    )


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
