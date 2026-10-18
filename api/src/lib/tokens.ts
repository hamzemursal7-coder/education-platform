import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { UserRole } from "@prisma/client";

export type AccessClaims = {
  sub: string;
  role: UserRole;
  schoolId: string | null;
};

export function signAccessToken(claims: AccessClaims) {
  return jwt.sign(claims, config.jwtAccessSecret, { expiresIn: "15m" });
}

export function readAccessToken(token: string) {
  return jwt.verify(token, config.jwtAccessSecret) as AccessClaims;
}

export function newRefreshToken() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
