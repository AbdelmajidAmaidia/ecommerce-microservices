import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../auth/AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

function renderProtected(path = "/protected", roles?: string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Connexion</p>} />
        <Route path="/forbidden" element={<p>Accès refusé</p>} />
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/protected" element={<p>Contenu protégé</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it("redirects an unauthenticated visitor to login", () => {
    mockedUseAuth.mockReturnValue({
      initialized: true,
      authenticated: false,
      roles: [],
      apiAudienceOk: true,
      claims: undefined,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProtected();
    expect(screen.getByText("Connexion")).toBeInTheDocument();
  });

  it("denies a user who lacks an administrator role", () => {
    mockedUseAuth.mockReturnValue({
      initialized: true,
      authenticated: true,
      roles: ["user"],
      apiAudienceOk: true,
      claims: undefined,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProtected("/protected", ["admin"]);
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });

  it("renders a protected page for an authenticated user", () => {
    mockedUseAuth.mockReturnValue({
      initialized: true,
      authenticated: true,
      roles: ["user"],
      apiAudienceOk: true,
      claims: undefined,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProtected();
    expect(screen.getByText("Contenu protégé")).toBeInTheDocument();
  });
});
