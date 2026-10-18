import { prisma } from "./prisma.js";

export async function writeAudit(input: {
  schoolId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
}) {
  await prisma.auditEvent.create({
    data: {
      schoolId: input.schoolId ?? null,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
    },
  });
}
