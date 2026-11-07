import { useCallback, useState } from "react";
import { clearToken, readToken, saveToken } from "./tokenStorage";

export function useSession() {
  const [token, setToken] = useState(readToken);

  const signIn = useCallback((next: string) => {
    saveToken(next);
    setToken(next);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
  }, []);

  return { token, signIn, signOut };
}
