import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addAttendeeToMeet } from "@/lib/google/calendar";
import { shareFolderWithUser } from "@/lib/google/drive";

const XENDIT_EXTERNAL_ID_PREFIX = "meetly-";

export async function POST(req: NextRequest) {
  try {
    // Verify webhook token
    const callbackToken = req.headers.get("x-callback-token");

    if (
      process.env.XENDIT_WEBHOOK_TOKEN &&
      callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Handle invoice paid event
    if (body.status === "PAID" && body.external_id) {
      const rawExternalId = body.external_id as string;
      const purchaseId = rawExternalId.startsWith(XENDIT_EXTERNAL_ID_PREFIX)
        ? rawExternalId.slice(XENDIT_EXTERNAL_ID_PREFIX.length)
        : rawExternalId;

      const purchase = await prisma.packagePurchase.findUnique({
        where: { id: purchaseId },
        include: {
          buyer: true,
          package: {
            include: {
              event: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!purchase) {
        return NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 }
        );
      }

      // Update purchase status
      await prisma.packagePurchase.update({
        where: { id: purchaseId },
        data: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      // Grant access to Google Meet and Drive
      const packageData = purchase.package;
      const creatorUserId = packageData.event.userId;
      const buyerEmail = purchase.buyer.email;

      try {
        // Add buyer to Google Meet events
        if (packageData.googleMeetings) {
          const meetings = packageData.googleMeetings as Array<{
            meetingId: string;
            hangoutLink: string;
          }>;

          for (const meeting of meetings) {
            try {
              await addAttendeeToMeet({
                userId: creatorUserId,
                meetingId: meeting.meetingId,
                attendeeEmail: buyerEmail,
              });
            } catch (error) {
              console.error(
                `Failed to add attendee to meeting ${meeting.meetingId}:`,
                error
              );
            }
          }
        }

        // Share Drive folder with buyer
        if (packageData.googleDriveFolderId) {
          try {
            await shareFolderWithUser({
              userId: creatorUserId,
              folderId: packageData.googleDriveFolderId,
              email: buyerEmail,
              role: "reader",
            });
          } catch (error) {
            console.error(
              `Failed to share Drive folder ${packageData.googleDriveFolderId}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error("Error granting access:", error);
        // Don't fail the webhook, payment is already marked as paid
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
