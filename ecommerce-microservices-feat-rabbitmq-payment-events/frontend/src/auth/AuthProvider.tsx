import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { initializeKeycloak, keycloak } from "./keycloak";

interface TokenClaims {
  sub?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  aud?: string | string[];
  realm_access?: { roles?: string[] };
}

interface AuthContextValue {
  initialized: boolean;
  authenticated: boolean;
  roles: string[];
  apiAudienceOk: boolean;
  claims: TokenClaims | undefined;
  error: string | null;
  login: (redirectPath?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    initializeKeycloak()
      .then((isAuthenticated) => {
        if (active) {
          setAuthenticated(isAuthenticated);
          setInitialized(true);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError("Impossible de joindre Keycloak ou de terminer l'initialisation.");
          setInitialized(true);
        }
      });

    keycloak.onAuthSuccess = () => {
      if (active) setAuthenticated(true);
    };
    keycloak.onAuthLogout = () => {
      if (active) setAuthenticated(false);
    };
    keycloak.onTokenExpired = () => {
      void keycloak
        .updateToken(30)
        .then(() => active && setAuthenticated(Boolean(keycloak.authenticated)))
        .catch(() => active && setAuthenticated(false));
    };

    return () => {
      active = false;
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      keycloak.onTokenExpired = undefined;
    };
  }, []);

  const login = useCallback((redirectPath?: string) => {
    const redirectUri = redirectPath && redirectPath.startsWith("/")
      ? `${window.location.origin}${redirectPath}`
      : window.location.origin;
    void keycloak.login({ redirectUri });
  }, []);

  const logout = useCallback(() => {
    void keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const claims = keycloak.tokenParsed as TokenClaims | undefined;
  const roles = claims?.realm_access?.roles ?? [];
  const expectedAudience = import.meta.env.VITE_API_AUDIENCE || "ecommerce-api";
  const apiAudienceOk = Array.isArray(claims?.aud)
    ? claims.aud.includes(expectedAudience)
    : claims?.aud === expectedAudience;
  const value = useMemo(
    () => ({ initialized, authenticated, roles, apiAudienceOk, claims, error, login, logout }),
    [initialized, authenticated, roles, apiAudienceOk, claims, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return context;
}
