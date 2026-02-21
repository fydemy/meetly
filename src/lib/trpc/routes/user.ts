import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../context";
import { t } from "../trpc";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";

const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(30, "Slug must be at most 30 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug can only contain lowercase letters, numbers, and hyphens"
  );

export const userRouter = t.router({
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          name: true,
          image: true,
          slug: true,
          events: {
            orderBy: { createdAt: "desc" },
            include: {
              package: true,
            },
          },
        },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }
      return user;
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { id: true, name: true, email: true, image: true, slug: true },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        slug: z.union([z.literal(""), slugSchema]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
      if (input.slug === undefined) return { ok: true };

      const value = input.slug === "" ? null : input.slug;
      const existing = value
        ? await prisma.user.findFirst({
            where: { slug: value, id: { not: ctx.user.id } },
          })
        : null;
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This slug is already taken",
        });
      }

      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { slug: value },
      });
      return { ok: true };
    }),
});
