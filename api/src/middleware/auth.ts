import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { readAccessToken as readSessionCookie } from "../lib/sessionCookie.js";
import { readAccessToken } from "../lib/tokens.js";
import { HttpError } from "./error.js";

export type AuthUser = {
  id: string;
  role: UserRole;
  schoolId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  photoUrl?: string | null;
  status: string;
  /** True when a SUPER_ADMIN is temporarily working inside a school. */
  actingFromSuperAdmin?: boolean;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readSessionCookie(req);
  if (!token) {
    next(new HttpError(401, "Authentication is required."));
    return;
  }
  try {
    const claims = readAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== "ACTIVE") {
      next(new HttpError(401, "Authentication is required."));
      return;
    }
    const actingFromSuperAdmin =
      user.role === "SUPER_ADMIN" &&
      claims.role === "SCHOOL_ADMIN" &&
      Boolean(user.schoolId);
    req.authUser = {
      id: user.id,
      role: actingFromSuperAdmin ? "SCHOOL_ADMIN" : user.role,
      schoolId: user.role === "SUPER_ADMIN" && !actingFromSuperAdmin ? null : user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      photoUrl: user.photoUrl,
      status: user.status,
      actingFromSuperAdmin,
    };
    next();
  } catch {
    next(new HttpError(401, "Authentication is required."));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      next(new HttpError(403, "You are not allowed to access this record."));
      return;
    }
    next();
  };
}
