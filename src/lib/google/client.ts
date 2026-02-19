import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export async function getGoogleClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
  });

  if (!account?.accessToken) {
    throw new Error("No Google account linked or missing access token");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken: tokens.access_token,
          ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        },
      });
    }
  });

  return oauth2Client;
}
