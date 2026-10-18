import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";

async function schoolStaff(userId: string, roles: Array<"SCHOOL_ADMIN" | "ACCOUNTANT">) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
  const allowed =
    user?.school?.isActive &&
    (roles.includes(user.role as "SCHOOL_ADMIN" | "ACCOUNTANT") ||
      (user.role === "SUPER_ADMIN" && Boolean(user.schoolId)));
  if (!allowed) {
    throw new HttpError(403, "You are not allowed to access this record.");
  }
  return user!.school!;
}

async function nextValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "IdSequence" ("id", "value") VALUES (${key}, 1)
    ON CONFLICT ("id") DO UPDATE SET "value" = "IdSequence"."value" + 1
    RETURNING "value"
  `;
  return rows[0].value;
}

function feeStatus(amount: number, paidAmount: number, waived: boolean): "UNPAID" | "PARTIALLY_PAID" | "PAID" | "WAIVED" {
  if (waived) return "WAIVED";
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= amount) return "PAID";
  return "PARTIALLY_PAID";
}

export const feesRouter = Router();

feesRouter.get("/fees", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolStaff(req.authUser!.id, ["SCHOOL_ADMIN", "ACCOUNTANT"]);
    const fees = await prisma.studentFee.findMany({
      where: { schoolId: school.id },
      include: {
        enrollment: { include: { student: true, academicYear: true } },
        payments: { where: { voidedAt: null }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(fees.map((fee) => ({
      id: fee.id,
      title: fee.title,
      type: fee.type,
      amount: fee.amount,
      paidAmount: fee.paidAmount,
      balance: Math.max(fee.amount - fee.paidAmount, 0),
      status: fee.status,
      year: fee.enrollment.academicYear.name,
      student: `${fee.enrollment.student.firstName} ${fee.enrollment.student.fatherName}`,
      permanentId: fee.enrollment.student.permanentId,
      payments: fee.payments,
    })));
  } catch (error) {
    next(error);
  }
});

feesRouter.post("/fees", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolStaff(req.authUser!.id, ["SCHOOL_ADMIN", "ACCOUNTANT"]);
    const body = z.object({
      enrollmentId: z.string(),
      type: z.enum(["TUITION", "REGISTRATION", "TRANSPORT", "EXAM", "UNIFORM", "BOOKS", "OTHER"]),
      title: z.string().trim().min(2),
      amount: z.number().int().positive(),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Choose a student enrollment, fee type, title, and amount.");
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: body.data.enrollmentId, schoolId: school.id },
    });
    if (!enrollment) throw new HttpError(404, "Enrollment was not found.");
    const fee = await prisma.studentFee.create({
      data: {
        schoolId: school.id,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academicYearId,
        type: body.data.type,
        title: body.data.title,
        amount: body.data.amount,
      },
    });
    res.status(201).json(fee);
  } catch (error) {
    next(error);
  }
});

feesRouter.post("/fees/:id/payments", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolStaff(req.authUser!.id, ["SCHOOL_ADMIN", "ACCOUNTANT"]);
    const body = z.object({
      amount: z.number().int().positive(),
      note: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) throw new HttpError(400, "Payment amount is required.");
    const fee = await prisma.studentFee.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!fee) throw new HttpError(404, "Fee was not found.");
    if (fee.status === "WAIVED") throw new HttpError(400, "A waived fee cannot receive payments.");
    const balance = fee.amount - fee.paidAmount;
    if (body.data.amount > balance) throw new HttpError(400, "Payment is larger than the remaining balance.");
    const payment = await prisma.$transaction(async (tx) => {
      const sequence = await nextValue(tx, `receipt:${school.id}`);
      const receiptNumber = `RCP-${school.code}-${String(sequence).padStart(5, "0")}`;
      const created = await tx.payment.create({
        data: {
          studentFeeId: fee.id,
          amount: body.data.amount,
          receiptNumber,
          note: body.data.note,
          recordedByUserId: req.authUser!.id,
        },
      });
      const paidAmount = fee.paidAmount + body.data.amount;
      await tx.studentFee.update({
        where: { id: fee.id },
        data: { paidAmount, status: feeStatus(fee.amount, paidAmount, false) },
      });
      return created;
    });
    await writeAudit({
      schoolId: school.id,
      actorUserId: req.authUser!.id,
      action: "FEE_PAYMENT",
      entityType: "Payment",
      entityId: payment.id,
      summary: `Recorded payment ${payment.receiptNumber} amount ${payment.amount}`,
    });
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

feesRouter.post("/fees/:id/waive", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolStaff(req.authUser!.id, ["SCHOOL_ADMIN", "ACCOUNTANT"]);
    const reason = z.object({ reason: z.string().trim().min(3) }).safeParse(req.body);
    if (!reason.success) throw new HttpError(400, "A waiver reason is required.");
    const fee = await prisma.studentFee.findFirst({ where: { id: String(req.params.id), schoolId: school.id } });
    if (!fee) throw new HttpError(404, "Fee was not found.");
    await prisma.studentFee.update({
      where: { id: fee.id },
      data: { status: "WAIVED" },
    });
    res.json({ ok: true, reason: reason.data.reason });
  } catch (error) {
    next(error);
  }
});

feesRouter.post("/payments/:id/void", requireAuth, requireRole("SCHOOL_ADMIN", "ACCOUNTANT"), async (req, res, next) => {
  try {
    const school = await schoolStaff(req.authUser!.id, ["SCHOOL_ADMIN", "ACCOUNTANT"]);
    const reason = z.object({ reason: z.string().trim().min(3) }).safeParse(req.body);
    if (!reason.success) throw new HttpError(400, "A void reason is required.");
    const payment = await prisma.payment.findFirst({
      where: { id: String(req.params.id), voidedAt: null, studentFee: { schoolId: school.id } },
      include: { studentFee: true },
    });
    if (!payment) throw new HttpError(404, "Payment was not found.");
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { voidedAt: new Date(), voidReason: reason.data.reason },
      });
      const paidAmount = Math.max(payment.studentFee.paidAmount - payment.amount, 0);
      await tx.studentFee.update({
        where: { id: payment.studentFeeId },
        data: {
          paidAmount,
          status: feeStatus(payment.studentFee.amount, paidAmount, payment.studentFee.status === "WAIVED"),
        },
      });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
