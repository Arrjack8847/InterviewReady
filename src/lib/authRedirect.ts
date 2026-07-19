export function getSafeAuthRedirect(value: unknown): string {
  if (typeof value !== "string") {
    return "/dashboard";
  }

  const redirect = value.trim();

  const isUnsafe =
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.includes("\\") ||
    redirect.startsWith("/login") ||
    redirect.startsWith("/register");

  return isUnsafe ? "/dashboard" : redirect;
}
