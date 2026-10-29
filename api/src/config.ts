import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";
const rawSecret = process.env.JWT_ACCESS_SECRET?.trim();
const knownInsecureSecrets = new Set([
  "dev-only-access-secret",
  "replace-with-a-long-random-string",
  "dev-only-access-secret-change-before-production",
  "local-dev-secret-change-me-0123456789abcdef",
]);

if (isProduction && (!rawSecret || knownInsecureSecrets.has(rawSecret) || rawSecret.length < 32)) {
  throw new Error(
    "FATAL: JWT_ACCESS_SECRET must be set to a strong secret (at least 32 characters) in production.",
  );
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtAccessSecret: rawSecret || "dev-only-access-secret",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
