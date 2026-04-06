import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";

function getCanvasPath(channelId: string): string {
  return join(OPENCLAW_DIR, "workspace", "channels", channelId, "CANVAS.md");
}

function getKnowledgePath(channelId: string): string {
  return join(OPENCLAW_DIR, "workspace", "channels", channelId, "KNOWLEDGE.md");
}

// GET /api/channels/canvas?channelId=xxx&type=canvas|knowledge
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const type = req.nextUrl.searchParams.get("type") || "canvas";

  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const filePath = type === "knowledge"
    ? getKnowledgePath(channelId)
    : getCanvasPath(channelId);

  try {
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ channelId, type, content });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // File doesn't exist yet — return empty
      return NextResponse.json({ channelId, type, content: "" });
    }
    console.error("Error reading canvas:", err);
    return NextResponse.json({ error: "Failed to read canvas" }, { status: 500 });
  }
}

// PUT /api/channels/canvas — write canvas or knowledge content
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelId, content, type = "canvas" } = body;

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    if (typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const filePath = type === "knowledge"
      ? getKnowledgePath(channelId)
      : getCanvasPath(channelId);

    // Auto-create directory
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true, channelId, type });
  } catch (error) {
    console.error("Error writing canvas:", error);
    return NextResponse.json({ error: "Failed to write canvas" }, { status: 500 });
  }
}
