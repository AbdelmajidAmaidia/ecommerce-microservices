from app.database import Base, engine
from app.models import Order, OrderItem


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Order Service tables are ready.")


if __name__ == "__main__":
    main()
