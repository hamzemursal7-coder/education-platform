import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-only-access-secret",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
