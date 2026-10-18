import { prisma } from "./prisma.js";
import { newRefreshToken } from "./tokens.js";

export async function issueSetPasswordLink(userId: string) {
  const invite = newRefreshToken();
  await prisma.inviteToken.create({
    data: {
      userId,
      tokenHash: invite.tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return `/set-password?token=${invite.token}`;
}
