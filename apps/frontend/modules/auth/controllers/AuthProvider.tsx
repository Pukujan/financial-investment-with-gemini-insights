import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../services/authApi';
import { clearAuthToken, setAuthToken } from '../utils/authStorage';
import { LoginDialog } from '../views/LoginDialog';

interface AuthContextValue {
  /** Demo login is available on this server (optional sign-in). */
  loginAvailable: boolean;
  authenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  requestLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loginAvailable, setLoginAvailable] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await authApi.getStatus();
      setLoginAvailable(status.authRequired);
      setAuthenticated(status.authenticated);
    } catch {
      setLoginAvailable(false);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(
    async (username: string, password: string) => {
      const { token } = await authApi.login(username, password);
      setAuthToken(token);
      setAuthenticated(true);
      setLoginOpen(false);
    },
    []
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setAuthenticated(false);
    void refreshStatus();
  }, [refreshStatus]);

  const requestLogin = useCallback(() => {
    setLoginOpen(true);
  }, []);

  const value = useMemo(
    () => ({ loginAvailable, authenticated, login, logout, requestLogin }),
    [loginAvailable, authenticated, login, logout, requestLogin]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => void refreshStatus()}
      />
    </AuthContext.Provider>
  );
}
