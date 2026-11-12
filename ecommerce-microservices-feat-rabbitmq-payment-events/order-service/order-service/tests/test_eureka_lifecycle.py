from fastapi.testclient import TestClient

from app import main
from app.database import get_db


def test_eureka_client_lifecycle_uses_config_and_stops(monkeypatch):
    calls: list[tuple[str, dict[str, object]]] = []

    class FakeEurekaClient:
        def __init__(self, **configuration: object):
            self.configuration = configuration

        async def start(self) -> None:
            calls.append(("start", self.configuration))

        async def stop(self) -> None:
            calls.append(("stop", {}))

    monkeypatch.setattr(main, "EurekaClient", FakeEurekaClient)
    monkeypatch.setenv("EUREKA_ENABLED", "true")
    main.app.dependency_overrides[get_db] = lambda: None

    try:
        with TestClient(main.app) as client:
            assert client.get("/health").json() == {"status": "ok"}
            assert calls[0] == (
                "start",
                {
                    "eureka_server": "http://localhost:8761/eureka/",
                    "app_name": "order-service",
                    "instance_host": "127.0.0.1",
                    "instance_port": 8085,
                },
            )

        assert calls[-1] == ("stop", {})
    finally:
        main.app.dependency_overrides.clear()


def test_eureka_start_failure_does_not_prevent_fastapi_startup(monkeypatch):
    calls: list[str] = []

    class UnavailableEurekaClient:
        def __init__(self, **configuration: object):
            pass

        async def start(self) -> None:
            calls.append("start")
            raise RuntimeError("Eureka unavailable")

        async def stop(self) -> None:
            calls.append("stop")

    monkeypatch.setattr(main, "EurekaClient", UnavailableEurekaClient)
    monkeypatch.setenv("EUREKA_ENABLED", "true")
    main.app.dependency_overrides[get_db] = lambda: None

    try:
        with TestClient(main.app) as client:
            assert client.get("/health").json() == {"status": "ok"}

        assert calls == ["start", "stop"]
    finally:
        main.app.dependency_overrides.clear()
