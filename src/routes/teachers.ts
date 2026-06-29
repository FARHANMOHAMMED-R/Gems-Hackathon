import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const teachersRouter = Router();

const signInSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  classManaged: z.string().trim().min(1, "Class is required"),
  email: z.string().trim().email("Invalid email address"),
});

const meQuerySchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

function toTeacherResponse(t: {
  id: string;
  name: string;
  classManaged: string;
  email: string;
}) {
  return {
    id: t.id,
    name: t.name,
    classManaged: t.classManaged,
    email: t.email,
  };
}

/**
 * POST /api/teachers/sign-in
 *
 * Upserts a teacher profile by email. Returns the persisted profile.
 */
teachersRouter.post(
  "/teachers/sign-in",
  asyncHandler(async (req, res) => {
    const { name, classManaged, email } = signInSchema.parse(req.body);

    const teacher = await prisma.teacherProfile.upsert({
      where: { email },
      create: { name, classManaged, email },
      update: { name, classManaged },
      select: { id: true, name: true, classManaged: true, email: true },
    });

    res.json(toTeacherResponse(teacher));
  }),
);

/**
 * GET /api/teachers/me?email=...
 *
 * Restores a teacher session from a stored email address.
 */
teachersRouter.get(
  "/teachers/me",
  asyncHandler(async (req, res) => {
    const { email } = meQuerySchema.parse(req.query);

    const teacher = await prisma.teacherProfile.findUnique({
      where: { email },
      select: { id: true, name: true, classManaged: true, email: true },
    });

    if (!teacher) {
      throw new ApiError(404, "Teacher not found.");
    }

    res.json(toTeacherResponse(teacher));
  }),
);
