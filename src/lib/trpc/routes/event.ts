import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../context";
import { t } from "../trpc";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  cancelMeetEvent,
  createMeetEvent,
  updateMeetEvent,
} from "@/lib/google/calendar";
import { findOrCreateFolder } from "@/lib/google/drive";

const BUCKET = "editor-images";

const MAX_EVENTS_PER_USER = 5;
const MAX_MEETINGS_PER_EVENT = 3;

const editorBlockSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  data: z.record(z.unknown()),
});

const editorOutputSchema = z.object({
  time: z.number().optional(),
  blocks: z.array(editorBlockSchema),
  version: z.string().optional(),
});

export const eventRouter = t.router({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");

    return prisma.event.findMany({
      where: { userId: ctx.user.id },
      include: {
        package: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.id },
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
          package: true,
        },
      });

      if (!event) {
        throw new Error("Event not found");
      }

      return event;
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: editorOutputSchema,
        files: z.array(z.object({ blobUrl: z.string(), base64: z.string() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { content, files } = input;
      if (!ctx.user) throw new Error("Unauthorized");
      const userId = ctx.user.id;

      const eventCount = await prisma.event.count({ where: { userId } });
      if (eventCount >= MAX_EVENTS_PER_USER) {
        throw new Error(
          `You can create at most ${MAX_EVENTS_PER_USER} events. Delete an event to create a new one.`,
        );
      }

      const blobToPublicUrl: Record<string, string> = {};

      for (const { blobUrl, base64 } of files) {
        const buffer = Buffer.from(base64, "base64");
        const ext = ".png";
        const path = `${userId}/${crypto.randomUUID()}${ext}`;

        const { error } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, buffer, {
            contentType: "image/png",
            upsert: false,
          });

        if (error) throw new Error(`Upload failed: ${error.message}`);

        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        blobToPublicUrl[blobUrl] = publicUrl;
      }

      let contentJson = JSON.stringify(content);
      for (const [blobUrl, publicUrl] of Object.entries(blobToPublicUrl)) {
        contentJson = contentJson.split(blobUrl).join(publicUrl);
      }
      const contentWithUrls = JSON.parse(contentJson) as typeof content;

      let title = "";
      let imageUrl: string | null = null;

      type BlockData = { text?: unknown; file?: { url?: string } };
      for (const block of contentWithUrls.blocks ?? []) {
        const data = block.data as BlockData | undefined;
        if (block.type === "header" && !title && data?.text != null) {
          title = String(data.text).trim();
        }
        if (
          block.type === "image" &&
          imageUrl === null &&
          data?.file?.url != null
        ) {
          imageUrl = String(data.file.url);
        }
      }

      if (!title) title = "Untitled";

      const event = await prisma.event.create({
        data: {
          userId,
          title,
          imageUrl,
          content: contentWithUrls as object,
        },
      });

      // Check for package block and create Package record
      type PackageBlockData = {
        name?: string;
        price?: number;
        meetings?: Array<{ startDate?: string; timezone?: string }>;
        driveFolder?: { path?: string };
      };

      const packageBlock = contentWithUrls.blocks?.find(
        (b) => b.type === "package",
      );

      if (packageBlock) {
        const pkgData = packageBlock.data as PackageBlockData;
        const hasName = typeof pkgData.name === "string" && pkgData.name.trim().length > 0;
        const hasPrice = typeof pkgData.price === "number" && !Number.isNaN(pkgData.price);

        if (hasName && hasPrice) {
          // Create Google Meet events
          const googleMeetings: Array<{
            meetingId: string;
            hangoutLink: string;
            startDateTime: string;
            timezone: string;
          }> = [];

          const meetingsWithDate = (pkgData.meetings ?? []).filter(
            (m) => m.startDate,
          );
          const meetingsToCreate = meetingsWithDate.slice(
            0,
            MAX_MEETINGS_PER_EVENT,
          );
          if (meetingsToCreate.length > 0) {
            try {
              for (const meeting of meetingsToCreate) {
                const meetEvent = await createMeetEvent({
                  userId,
                  startDate: meeting.startDate!,
                  timezone: meeting.timezone || "UTC",
                  summary: `${pkgData.name} - Session`,
                  durationMinutes: 60,
                });

                googleMeetings.push({
                  meetingId: meetEvent.meetingId,
                  hangoutLink: meetEvent.hangoutLink,
                  startDateTime: meetEvent.startDateTime,
                  timezone: meeting.timezone || "UTC",
                });
              }
            } catch (error) {
              console.error("Failed to create Google Meet events:", error);
              // Continue without meetings if Google API fails
            }
          }

          // Create or find Google Drive folder (max 1 per event)
          let driveFolderId: string | null = null;
          const drivePath =
            typeof pkgData.driveFolder?.path === "string" &&
            pkgData.driveFolder.path.trim()
              ? pkgData.driveFolder.path.trim()
              : null;
          if (drivePath) {
            try {
              const folder = await findOrCreateFolder({
                userId,
                folderPath: drivePath,
              });
              driveFolderId = folder.folderId;
            } catch (error) {
              console.error("Failed to create/find Drive folder:", error);
            }
          }

          // Create Package record
          await prisma.package.create({
            data: {
              eventId: event.id,
              userId,
              name: pkgData.name!.trim(),
              price: Math.round(Number(pkgData.price)),
              currency: "IDR",
              googleMeetings:
                googleMeetings.length > 0 ? googleMeetings : undefined,
              googleDriveFolderId: driveFolderId || undefined,
            },
          });
        }
      }

      return event;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: editorOutputSchema,
        files: z.array(z.object({ blobUrl: z.string(), base64: z.string() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");
      const userId = ctx.user.id;

      const existingEvent = await prisma.event.findFirst({
        where: {
          id: input.id,
          userId,
        },
        include: {
          package: true,
        },
      });

      if (!existingEvent) {
        throw new Error("Event not found");
      }

      const { content, files } = input;

      const blobToPublicUrl: Record<string, string> = {};

      for (const { blobUrl, base64 } of files) {
        const buffer = Buffer.from(base64, "base64");
        const ext = ".png";
        const path = `${userId}/${crypto.randomUUID()}${ext}`;

        const { error } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, buffer, {
            contentType: "image/png",
            upsert: false,
          });

        if (error) throw new Error(`Upload failed: ${error.message}`);

        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        blobToPublicUrl[blobUrl] = publicUrl;
      }

      let contentJson = JSON.stringify(content);
      for (const [blobUrl, publicUrl] of Object.entries(blobToPublicUrl)) {
        contentJson = contentJson.split(blobUrl).join(publicUrl);
      }
      const contentWithUrls = JSON.parse(contentJson) as typeof content;

      let title = existingEvent.title;
      let imageUrl: string | null = existingEvent.imageUrl ?? null;

      type BlockData = { text?: unknown; file?: { url?: string } };
      for (const block of contentWithUrls.blocks ?? []) {
        const data = block.data as BlockData | undefined;
        if (block.type === "header" && data?.text != null) {
          title = String(data.text).trim() || title;
        }
        if (
          block.type === "image" &&
          data?.file?.url != null &&
          imageUrl === null
        ) {
          imageUrl = String(data.file.url);
        }
      }

      const updatedEvent = await prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          title,
          imageUrl,
          content: contentWithUrls as object,
        },
        include: {
          package: true,
        },
      });

      // Handle package + meetings updates
      type PackageBlockData = {
        name?: string;
        price?: number;
        meetings?: Array<{ startDate?: string; timezone?: string }>;
        driveFolder?: { path?: string };
      };

      const packageBlock = contentWithUrls.blocks?.find(
        (b) => b.type === "package",
      );

      const existingPackage = existingEvent.package;

      if (!packageBlock && existingPackage) {
        // If package block was removed, do not delete the package automatically
        // to avoid accidentally cancelling access for existing purchasers.
        return updatedEvent;
      }

      if (packageBlock) {
        const pkgData = packageBlock.data as PackageBlockData;

        if (pkgData.name && pkgData.price) {
          // Ensure we have or create a Package record
          let pkg = existingPackage;

          if (!pkg) {
            // Create new package (same as in create); cap Meet and Drive
            const googleMeetings: Array<{
              meetingId: string;
              hangoutLink: string;
              startDateTime: string;
              timezone: string;
            }> = [];

            const newMeetingsWithDate = (pkgData.meetings ?? []).filter(
              (m) => m.startDate,
            );
            const newMeetingsToCreate = newMeetingsWithDate.slice(
              0,
              MAX_MEETINGS_PER_EVENT,
            );
            if (newMeetingsToCreate.length > 0) {
              try {
                for (const meeting of newMeetingsToCreate) {
                  const meetEvent = await createMeetEvent({
                    userId,
                    startDate: meeting.startDate!,
                    timezone: meeting.timezone || "UTC",
                    summary: `${pkgData.name} - Session`,
                    durationMinutes: 60,
                  });
                  googleMeetings.push({
                    meetingId: meetEvent.meetingId,
                    hangoutLink: meetEvent.hangoutLink,
                    startDateTime: meetEvent.startDateTime,
                    timezone: meeting.timezone || "UTC",
                  });
                }
              } catch (error) {
                console.error("Failed to create Google Meet events:", error);
              }
            }

            let driveFolderId: string | null = null;
            const updateDrivePath =
              typeof pkgData.driveFolder?.path === "string" &&
              pkgData.driveFolder.path.trim()
                ? pkgData.driveFolder.path.trim()
                : null;
            if (updateDrivePath) {
              try {
                const folder = await findOrCreateFolder({
                  userId,
                  folderPath: updateDrivePath,
                });
                driveFolderId = folder.folderId;
              } catch (error) {
                console.error("Failed to create/find Drive folder:", error);
              }
            }

            pkg = await prisma.package.create({
              data: {
                eventId: updatedEvent.id,
                userId,
                name: pkgData.name,
                price: pkgData.price,
                currency: "IDR",
                googleMeetings:
                  googleMeetings.length > 0 ? googleMeetings : undefined,
                googleDriveFolderId: driveFolderId || undefined,
              },
            });
          } else {
            // Update existing package, including rescheduling Google Meet events
            const existingMeetings =
              (pkg.googleMeetings as unknown as Array<{
                meetingId: string;
                hangoutLink: string;
                startDateTime: string;
                timezone: string;
              }> | null) ?? [];

            const requestedMeetings = (pkgData.meetings ?? [])
              .filter((m) => m.startDate)
              .slice(0, MAX_MEETINGS_PER_EVENT);

            const updatedGoogleMeetings: Array<{
              meetingId: string;
              hangoutLink: string;
              startDateTime: string;
              timezone: string;
            }> = [];

            // Update or create meetings to match requested schedule
            for (let i = 0; i < requestedMeetings.length; i++) {
              const meeting = requestedMeetings[i];
              if (!meeting.startDate) continue;

              const existing = existingMeetings[i];

              if (existing) {
                try {
                  await updateMeetEvent({
                    userId,
                    meetingId: existing.meetingId,
                    startDate: meeting.startDate,
                    timezone: meeting.timezone || existing.timezone || "UTC",
                    summary: `${pkgData.name} - Session`,
                    durationMinutes: 60,
                  });

                  updatedGoogleMeetings.push({
                    meetingId: existing.meetingId,
                    hangoutLink: existing.hangoutLink,
                    startDateTime: meeting.startDate,
                    timezone: meeting.timezone || existing.timezone || "UTC",
                  });
                } catch (error) {
                  console.error(
                    "Failed to update Google Meet event during reschedule:",
                    error,
                  );
                  updatedGoogleMeetings.push(existing);
                }
              } else {
                try {
                  const meetEvent = await createMeetEvent({
                    userId,
                    startDate: meeting.startDate,
                    timezone: meeting.timezone || "UTC",
                    summary: `${pkgData.name} - Session`,
                    durationMinutes: 60,
                  });

                  updatedGoogleMeetings.push({
                    meetingId: meetEvent.meetingId,
                    hangoutLink: meetEvent.hangoutLink,
                    startDateTime: meetEvent.startDateTime,
                    timezone: meeting.timezone || "UTC",
                  });
                } catch (error) {
                  console.error(
                    "Failed to create new Google Meet event during reschedule:",
                    error,
                  );
                }
              }
            }

            // Cancel any extra existing meetings that are no longer in the schedule
            if (requestedMeetings.length < existingMeetings.length) {
              for (
                let i = requestedMeetings.length;
                i < existingMeetings.length;
                i++
              ) {
                const toCancel = existingMeetings[i];
                if (!toCancel) continue;
                try {
                  await cancelMeetEvent({
                    userId,
                    meetingId: toCancel.meetingId,
                  });
                } catch (error) {
                  console.error(
                    "Failed to cancel Google Meet event during reschedule:",
                    error,
                  );
                }
              }
            }

            await prisma.package.update({
              where: { id: pkg.id },
              data: {
                name: pkgData.name,
                price: pkgData.price,
                googleMeetings:
                  updatedGoogleMeetings.length > 0
                    ? updatedGoogleMeetings
                    : undefined,
              },
            });
          }
        }
      }

      return updatedEvent;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Unauthorized");

      const result = await prisma.event.deleteMany({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
      });

      if (result.count === 0) {
        throw new Error("Event not found");
      }

      return { success: true };
    }),
});
