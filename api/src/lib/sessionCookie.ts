import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";

const SESSION_KEY = /^[a-f0-9]{32}$/;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.cookieSecure,
  path: "/",
};

export function newSessionKey() {
  return randomBytes(16).toString("hex");
}

export function sessionKeyFrom(req: Request) {
  const value = req.get("x-session-key")?.trim() ?? "";
  return SESSION_KEY.test(value) ? value : "";
}

export function readAccessToken(req: Request) {
  const key = sessionKeyFrom(req);
  if (key && req.cookies?.[`emp_access_${key}`]) {
    return req.cookies[`emp_access_${key}`] as string;
  }
  return req.cookies?.emp_access as string | undefined;
}

export function readRefreshToken(req: Request) {
  const key = sessionKeyFrom(req);
  if (key && req.cookies?.[`emp_refresh_${key}`]) {
    return req.cookies[`emp_refresh_${key}`] as string;
  }
  return req.cookies?.emp_refresh as string | undefined;
}

export function writeSession(res: Response, key: string, accessToken: string, refreshToken?: string) {
  if (key) {
    res.cookie(`emp_access_${key}`, accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    if (refreshToken) {
      res.cookie(`emp_refresh_${key}`, refreshToken, { ...cookieBase, maxAge: 14 * 24 * 60 * 60 * 1000 });
    }
  }
  // Write base shared cookie as universal fallback for new tabs, page reloads, and direct deep-links
  res.cookie("emp_access", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
  if (refreshToken) {
    res.cookie("emp_refresh", refreshToken, { ...cookieBase, maxAge: 14 * 24 * 60 * 60 * 1000 });
  }
}

export function clearSession(res: Response, key?: string) {
  res.clearCookie("emp_access", cookieBase);
  res.clearCookie("emp_refresh", cookieBase);
  if (key) {
    res.clearCookie(`emp_access_${key}`, cookieBase);
    res.clearCookie(`emp_refresh_${key}`, cookieBase);
  }
}

export function clearSharedSession(res: Response) {
  res.clearCookie("emp_access", cookieBase);
  res.clearCookie("emp_refresh", cookieBase);
}
