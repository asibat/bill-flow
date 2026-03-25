export function getAuthCallbackUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/auth/callback`;
  }

  return "http://localhost:3000/auth/callback";
}
