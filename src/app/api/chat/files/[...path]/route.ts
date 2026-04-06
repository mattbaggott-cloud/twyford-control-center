import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { OPENCLAW_WORKSPACE } from "@/lib/paths";

const UPLOAD_BASE = path.join(OPENCLAW_WORKSPACE, "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const segments = pathSegments || [];

    // Security: ensure path stays within upload base
    const filePath = path.join(UPLOAD_BASE, ...segments);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_BASE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();

    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
    };

    const contentType = mimeMap[ext] || "application/octet-stream";
    const filename = path.basename(resolved);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentType.startsWith("image/")
          ? "inline"
          : `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
