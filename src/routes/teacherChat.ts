import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const teacherChatRouter = Router();

const sendSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  classManaged: z.string().trim().min(1),
  body: z.string().trim().min(1).max(2000),
});

const listQuery = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function toMessage(m: {
  id: string;
  teacherId: string;
  teacherName: string;
  classManaged: string;
  teacherEmail: string;
  body: string;
  createdAt: Date;
}) {
  return {
    id: m.id,
    teacherId: m.teacherId,
    teacherName: m.teacherName,
    classManaged: m.classManaged,
    teacherEmail: m.teacherEmail,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

/** GET /api/teachers — all signed-in teachers (for chat roster). */
teacherChatRouter.get(
  "/teachers",
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.teacherProfile.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, classManaged: true, email: true },
    });
    res.json({ teachers });
  }),
);

/** GET /api/teachers/chat/messages */
teacherChatRouter.get(
  "/teachers/chat/messages",
  asyncHandler(async (req, res) => {
    const { after, limit } = listQuery.parse(req.query);
    const messages = await prisma.teacherChatMessage.findMany({
      where: after ? { createdAt: { gt: new Date(after) } } : undefined,
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    res.json({ messages: messages.map(toMessage) });
  }),
);

/** POST /api/teachers/chat/messages — send a staff-lounge message. */
teacherChatRouter.post(
  "/teachers/chat/messages",
  asyncHandler(async (req, res) => {
    const body = sendSchema.parse(req.body);

    const teacher = await prisma.teacherProfile.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        name: body.name,
        classManaged: body.classManaged,
      },
      update: { name: body.name, classManaged: body.classManaged },
      select: { id: true },
    });

    const message = await prisma.teacherChatMessage.create({
      data: {
        teacherId: teacher.id,
        teacherName: body.name,
        classManaged: body.classManaged,
        teacherEmail: body.email,
        body: body.body,
      },
    });

    res.status(201).json({ message: toMessage(message) });
  }),
);

/** DELETE /api/teachers/chat/messages/:id — author only (by email). */
teacherChatRouter.delete(
  "/teachers/chat/messages/:id",
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const email = z.string().trim().email().parse(req.query.email);

    const existing = await prisma.teacherChatMessage.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Message not found.");
    if (existing.teacherEmail !== email) {
      throw new ApiError(403, "You can only delete your own messages.");
    }

    await prisma.teacherChatMessage.delete({ where: { id } });
    res.json({ ok: true, deletedId: id });
  }),
);
