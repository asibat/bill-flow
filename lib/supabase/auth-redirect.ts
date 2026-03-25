export function getAuthRedirectUrl(path = "/auth/callback") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalizedPath}`;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}${normalizedPath}`;
  }

  return `http://localhost:3000${normalizedPath}`;
}

export function getAuthCallbackUrl() {
  return getAuthRedirectUrl("/auth/callback");
}
