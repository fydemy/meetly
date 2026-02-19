import { google } from "googleapis";
import { getGoogleClient } from "./client";

export async function findOrCreateFolder(params: {
  userId: string;
  folderPath: string;
}) {
  const { userId, folderPath } = params;

  const client = await getGoogleClient(userId);
  const drive = google.drive({ version: "v3", auth: client });

  // Search for existing folder
  const searchResponse = await drive.files.list({
    q: `name='${folderPath}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return {
      folderId: searchResponse.data.files[0].id!,
      folderName: searchResponse.data.files[0].name!,
    };
  }

  // Create new folder if not found
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderPath,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, name",
  });

  return {
    folderId: createResponse.data.id!,
    folderName: createResponse.data.name!,
  };
}

export async function shareFolderWithUser(params: {
  userId: string;
  folderId: string;
  email: string;
  role?: "reader" | "writer";
}) {
  const { userId, folderId, email, role = "reader" } = params;

  const client = await getGoogleClient(userId);
  const drive = google.drive({ version: "v3", auth: client });

  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: "user",
      role,
      emailAddress: email,
    },
    sendNotificationEmail: true,
  });
}
