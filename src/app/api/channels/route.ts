import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type { Channel } from "@/types/channel";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const CHANNELS_FILE = join(OPENCLAW_DIR, "workspace", "channels", "index.json");

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: "general",
    name: "#general",
    description: "General discussion for all agents",
    members: ["woods", "ford"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    pinned: true,
    archived: false,
  },
  {
    id: "twyford-cc-dev",
    name: "#twyford-cc-dev",
    description: "Twyford Control Center development",
    members: ["woods", "ford"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    pinned: true,
    archived: false,
  },
];

async function readChannels(): Promise<Channel[]> {
  try {
    const raw = await readFile(CHANNELS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data.channels || [];
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // First access — create defaults
      await writeChannels(DEFAULT_CHANNELS);
      return DEFAULT_CHANNELS;
    }
    throw err;
  }
}

async function writeChannels(channels: Channel[]): Promise<void> {
  await mkdir(dirname(CHANNELS_FILE), { recursive: true });
  await writeFile(
    CHANNELS_FILE,
    JSON.stringify({ version: 1, channels }, null, 2),
    "utf-8"
  );
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/^#\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET /api/channels — list all channels
export async function GET(req: NextRequest) {
  try {
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
    let channels = await readChannels();
    if (!includeArchived) {
      channels = channels.filter((c) => !c.archived);
    }
    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Error reading channels:", error);
    return NextResponse.json({ error: "Failed to read channels" }, { status: 500 });
  }
}

// POST /api/channels — create a new channel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description = "", members = ["woods", "ford"] } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = toKebabCase(name);
    if (!id) {
      return NextResponse.json({ error: "Invalid channel name" }, { status: 400 });
    }

    const channels = await readChannels();

    // Check for duplicate
    if (channels.some((c) => c.id === id && !c.archived)) {
      return NextResponse.json({ error: "Channel already exists" }, { status: 409 });
    }

    const newChannel: Channel = {
      id,
      name: `#${id}`,
      description,
      members,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      pinned: false,
      archived: false,
    };

    channels.push(newChannel);
    await writeChannels(channels);

    return NextResponse.json({ channel: newChannel }, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }
}

// PUT /api/channels — update a channel
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    const channels = await readChannels();
    const idx = channels.findIndex((c) => c.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Apply allowed updates
    if (updates.name !== undefined) {
      const newId = toKebabCase(updates.name);
      channels[idx].name = `#${newId}`;
      // Don't change the id — that's the persistent key
    }
    if (updates.description !== undefined) channels[idx].description = updates.description;
    if (updates.pinned !== undefined) channels[idx].pinned = updates.pinned;
    if (updates.members !== undefined) channels[idx].members = updates.members;
    if (updates.archived !== undefined) channels[idx].archived = updates.archived;

    await writeChannels(channels);

    return NextResponse.json({ channel: channels[idx] });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json({ error: "Failed to update channel" }, { status: 500 });
  }
}

// DELETE /api/channels — archive a channel (soft delete)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }

    const channels = await readChannels();
    const idx = channels.findIndex((c) => c.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    channels[idx].archived = true;
    await writeChannels(channels);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving channel:", error);
    return NextResponse.json({ error: "Failed to archive channel" }, { status: 500 });
  }
}
