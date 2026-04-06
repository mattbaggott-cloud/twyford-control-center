import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { OPENCLAW_WORKSPACE } from "@/lib/paths";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sessionKey = (formData.get("sessionKey") as string) || "unknown";
    const results: { url: string; filename: string; size: number; type: string }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key === "sessionKey") continue;
      if (!(value instanceof Blob)) continue;

      const file = value as File;
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        continue; // Skip disallowed types
      }
      if (file.size > MAX_SIZE_BYTES) {
        continue; // Skip oversized files
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${timestamp}-${safeName}`;

      // Sanitize session key for filesystem
      const safeSession = sessionKey.replace(/[^a-zA-Z0-9._:-]/g, "_");
      const uploadDir = path.join(OPENCLAW_WORKSPACE, "uploads", safeSession);
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      // URL path for serving
      const urlPath = `/api/chat/files/${safeSession}/${filename}`;

      results.push({
        url: urlPath,
        filename: file.name,
        size: file.size,
        type: file.type,
      });
    }

    return NextResponse.json({ files: results });
  } catch (err) {
    console.error("[upload] Error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
