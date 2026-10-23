import { prisma } from "./prisma.js";
import { newRefreshToken } from "./tokens.js";
import { HttpError } from "../middleware/error.js";

export async function issueSetPasswordLink(userId: string) {
  const invite = newRefreshToken();
  await prisma.$transaction([
    prisma.inviteToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.inviteToken.create({
      data: {
        userId,
        tokenHash: invite.tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return `/set-password/${invite.token}`;
}

export async function syncLoginEmail(userId: string, email: string) {
  const next = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new HttpError(400, "Enter a valid email.");
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!current) throw new HttpError(404, "Account was not found.");
  if (current.email.toLowerCase() === next) return next;
  const taken = await prisma.user.findUnique({ where: { email: next }, select: { id: true } });
  if (taken) throw new HttpError(409, "This email is already used by another account.");
  await prisma.user.update({ where: { id: userId }, data: { email: next } });
  return next;
}
