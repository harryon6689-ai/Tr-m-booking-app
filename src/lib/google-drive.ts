import { createAdminClient } from "@/lib/supabase/admin-client";

/**
 * Talks to Google's OAuth/Drive REST APIs directly (no `googleapis` SDK, to
 * avoid bundling a heavy dependency for what's just a handful of endpoints).
 * Only ever import this from "use server" files or route handlers — it reads
 * the service-role key and Google client secret.
 */

const SETTINGS_KEY = "google_drive";
const BACKUP_FOLDER_NAME = "TRẠM Backups";
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

interface GoogleDriveConnection {
  refresh_token: string;
  email: string;
  folder_id?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

export function googleClientId() {
  return requireEnv("GOOGLE_CLIENT_ID");
}

export function googleClientSecret() {
  return requireEnv("GOOGLE_CLIENT_SECRET");
}

export async function getGoogleDriveConnection(): Promise<GoogleDriveConnection | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return (data?.value as GoogleDriveConnection | undefined) ?? null;
}

export async function saveGoogleDriveConnection(
  connection: GoogleDriveConnection
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: connection });
  if (error) throw error;
}

export async function clearGoogleDriveConnection(): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("app_settings").delete().eq("key", SETTINGS_KEY);
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Không lấy được access token từ Google (${res.status}).`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function findOrCreateBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${BACKUP_FOLDER_NAME}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (searchRes.ok) {
    const searchJson = (await searchRes.json()) as { files: { id: string }[] };
    if (searchJson.files.length > 0) return searchJson.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Không tạo được thư mục sao lưu trên Drive (${createRes.status}).`);
  }
  const createJson = (await createRes.json()) as { id: string };
  return createJson.id;
}

/** Uploads an .xlsx file (as raw bytes) to the connected Drive account's backup folder. */
export async function uploadBackupToDrive(
  fileBytes: Uint8Array,
  filename: string
): Promise<{ error: string | null }> {
  const connection = await getGoogleDriveConnection();
  if (!connection) return { error: "Chưa kết nối Google Drive." };

  try {
    const accessToken = await getAccessToken(connection.refresh_token);

    let folderId = connection.folder_id;
    if (!folderId) {
      folderId = await findOrCreateBackupFolder(accessToken);
      await saveGoogleDriveConnection({ ...connection, folder_id: folderId });
    }

    const boundary = "tram-backup-boundary";
    const metadata = JSON.stringify({ name: filename, parents: [folderId] });
    const preamble =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;

    const body = Buffer.concat([
      Buffer.from(preamble, "utf-8"),
      Buffer.from(fileBytes),
      Buffer.from(closing, "utf-8"),
    ]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Tải file lên Drive thất bại (${uploadRes.status}): ${text}`);
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Lỗi không xác định." };
  }
}
