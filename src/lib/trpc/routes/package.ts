import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../context";
import { t } from "../trpc";
import { prisma } from "@/lib/prisma";
import { xenditClient } from "@/lib/xendit/client";

async function runEnrollFlow(params: {
  packageId: string;
  buyerId: string;
  payerEmail: string;
}) {
  const { packageId, buyerId, payerEmail } = params;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    throw new Error("Package not found");
  }

  const existingPurchase = await prisma.packagePurchase.findFirst({
    where: {
      packageId,
      buyerId,
      status: "paid",
    },
  });

  if (existingPurchase) {
    throw new Error("You have already purchased this package");
  }

  const purchase = await prisma.packagePurchase.create({
    data: {
      packageId,
      buyerId,
      status: "pending",
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const successRedirectUrl = `${baseUrl}/success?purchase=${purchase.id}`;
  const failureRedirectUrl = `${baseUrl}/failed?purchase=${purchase.id}`;

  let invoice = null;

  if (process.env.NODE_ENV === "production") {
    const proxyUrl = process.env.PAYMENT_PROXY_URL!;
    const data = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId: `meetly-${purchase.id}`,
        amount: pkg.price,
        description: `Package: ${pkg.name}`,
        currency: pkg.currency as "IDR",
        payerEmail,
        successRedirectUrl,
        failureRedirectUrl,
      }),
    });
    invoice = await data.json();
  } else {
    invoice = await xenditClient.Invoice.createInvoice({
      data: {
        externalId: `meetly-${purchase.id}`,
        amount: pkg.price,
        description: `Package: ${pkg.name}`,
        currency: pkg.currency as "IDR",
        payerEmail,
        successRedirectUrl,
        failureRedirectUrl,
      },
    });
  }

  await prisma.packagePurchase.update({
    where: { id: purchase.id },
    data: {
      xenditInvoiceId: invoice?.id,
    },
  });

  return {
    purchaseId: purchase.id,
    invoiceUrl: invoice?.invoiceUrl,
  };
}

const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const packageRouter = t.router({
  getGoogleScopes: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;
    const account = await prisma.account.findFirst({
      where: { userId, providerId: "google" },
      select: { scope: true },
    });
    const scope = account?.scope ?? "";
    return {
      hasCalendarScope: scope.includes(CALENDAR_SCOPE),
      hasDriveScope: scope.includes(DRIVE_SCOPE),
    };
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const pkg = await prisma.package.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          googleMeetings: true,
          googleDriveFolderId: true,
          createdAt: true,
          event: {
            select: {
              title: true,
              userId: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!pkg) {
        throw new Error("Package not found");
      }

      return {
        ...pkg,
        googleMeetings: pkg.googleMeetings as unknown as Array<{
          meetingId: string;
          hangoutLink: string;
          startDateTime: string;
          timezone: string;
        }> | null,
      };
    }),

  purchase: protectedProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return runEnrollFlow({
        packageId: input.packageId,
        buyerId: ctx.user.id,
        payerEmail: ctx.user.email,
      });
    }),

  enroll: publicProcedure
    .input(
      z.object({
        packageId: z.string(),
        name: z.string().min(1, "Name is required").optional(),
        email: z.string().email("Valid email is required").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pkg = await prisma.package.findUnique({
        where: { id: input.packageId },
      });
      if (!pkg) throw new Error("Package not found");

      let buyerId: string;
      let payerEmail: string;

      if (ctx.user) {
        buyerId = ctx.user.id;
        payerEmail = ctx.user.email;
      } else {
        if (!input.name?.trim() || !input.email?.trim()) {
          throw new Error(
            "Name and email are required to enroll without an account",
          );
        }
        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        let user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) {
          user = await prisma.user.create({
            data: {
              id: crypto.randomUUID(),
              name,
              email,
              emailVerified: false,
            },
          });
        }
        buyerId = user.id;
        payerEmail = user.email;
      }

      return runEnrollFlow({
        packageId: input.packageId,
        buyerId,
        payerEmail,
      });
    }),

  getUserPurchases: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");

    const purchases = await prisma.packagePurchase.findMany({
      where: { buyerId: ctx.user.id },
      include: {
        package: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return purchases;
  }),

  getPurchaseById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      const purchase = await prisma.packagePurchase.findFirst({
        where: {
          id: input.id,
          buyerId: ctx.user.id,
        },
        include: {
          package: {
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      if (!purchase) {
        throw new Error("Purchase not found");
      }

      return {
        ...purchase,
        package: {
          ...purchase.package,
          googleMeetings: purchase.package.googleMeetings as unknown as Array<{
            meetingId: string;
            hangoutLink: string;
            startDateTime: string;
            timezone: string;
          }> | null,
        },
      };
    }),

  getTotalRevenue: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");

    const events = await prisma.event.findMany({
      where: { userId: ctx.user.id },
      include: { package: true },
    });

    let totalRevenue = 0;
    let currency = "IDR";

    for (const event of events) {
      if (!event.package) continue;
      const paidCount = await prisma.packagePurchase.count({
        where: {
          packageId: event.package.id,
          status: "paid",
        },
      });
      totalRevenue += paidCount * event.package.price;
      if (event.package.currency) currency = event.package.currency;
    }

    return { totalRevenue, currency };
  }),

  getEnrollmentsForEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      const event = await prisma.event.findFirst({
        where: {
          id: input.eventId,
          userId: ctx.user.id,
        },
        include: {
          package: true,
        },
      });

      if (!event || !event.package) {
        return {
          enrollments: [],
          revenue: 0,
          currency: "IDR",
          packageName: "",
        };
      }

      const purchases = await prisma.packagePurchase.findMany({
        where: { packageId: event.package.id },
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const paidCount = purchases.filter((p) => p.status === "paid").length;
      const revenue = paidCount * event.package.price;

      return {
        packageName: event.package.name,
        currency: event.package.currency,
        revenue,
        paidCount,
        enrollments: purchases.map((p) => ({
          id: p.id,
          status: p.status,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
          buyer: p.buyer,
        })),
      };
    }),
});
