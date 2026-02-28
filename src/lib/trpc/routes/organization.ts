import { z } from "zod";
import { protectedProcedure } from "../context";
import { t } from "../trpc";
import { prisma } from "@/lib/prisma";

export const organizationRouter = t.router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        logoUrl: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const userId = ctx.user.id;

      const org = await prisma.organization.create({
        data: {
          name: input.name.trim(),
          logoUrl: input.logoUrl ? input.logoUrl.trim() : null,
          ownerId: userId,
          members: {
            create: {
              userId,
              email: ctx.user.email,
              role: "owner",
              status: "approved",
            },
          },
        },
      });

      return org;
    }),

  getMyOwned: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const userId = ctx.user.id;

    const orgs = await prisma.organization.findMany({
      where: { ownerId: userId },
      include: {
        members: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return orgs;
  }),

  getMyApproved: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const { id, email } = ctx.user;

    const memberships = await prisma.organizationMembership.findMany({
      where: {
        status: "approved",
        OR: [{ userId: id }, { userId: null, email }],
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      organization: m.organization,
    }));
  }),

  getMyPendingInvites: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const { id, email } = ctx.user;

    const invites = await prisma.organizationMembership.findMany({
      where: {
        status: "pending",
        OR: [{ userId: id }, { userId: null, email }],
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((i) => ({
      id: i.id,
      role: i.role,
      organization: {
        id: i.organization.id,
        name: i.organization.name,
        logoUrl: i.organization.logoUrl,
      },
    }));
  }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.enum(["member", "admin"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const userId = ctx.user.id;

      const organization = await prisma.organization.findUnique({
        where: { id: input.organizationId },
      });
      if (!organization || organization.ownerId !== userId) {
        throw new Error("You are not allowed to invite members to this organization");
      }

      const existing = await prisma.organizationMembership.findFirst({
        where: {
          organizationId: input.organizationId,
          email: input.email.toLowerCase(),
        },
      });

      if (existing) {
        return prisma.organizationMembership.update({
          where: { id: existing.id },
          data: {
            status: "pending",
            role: input.role ?? existing.role,
          },
        });
      }

      const membership = await prisma.organizationMembership.create({
        data: {
          organizationId: input.organizationId,
          email: input.email.toLowerCase(),
          role: input.role ?? "member",
          status: "pending",
        },
      });

      return membership;
    }),

  respondToInvite: protectedProcedure
    .input(
      z.object({
        membershipId: z.string(),
        approve: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const { id, email } = ctx.user;

      const membership = await prisma.organizationMembership.findUnique({
        where: { id: input.membershipId },
      });

      if (!membership) {
        throw new Error("Invite not found");
      }

      if (
        membership.userId &&
        membership.userId !== id
      ) {
        throw new Error("You are not allowed to respond to this invite");
      }

      if (!membership.userId && membership.email !== email) {
        throw new Error("You are not allowed to respond to this invite");
      }

      const status = input.approve ? "approved" : "rejected";

      const updated = await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: {
          status,
          userId: membership.userId ?? id,
        },
      });

      return updated;
    }),
});

