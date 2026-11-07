const KEY = "raven.sessionToken";

// storage can throw in private browsing or when site data is blocked; a missing token just means "signed out"
export function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // the session still works until the tab closes
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing stored, nothing to clear
  }
}
