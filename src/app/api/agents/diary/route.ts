import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";

export const dynamic = "force-dynamic";

interface DiaryEntry {
  date: string;
  content: string;
  sizeBytes: number;
  estimatedTokens: number;
}

// Map agent IDs to their workspace memory directories
function getMemoryDir(agentId: string): string {
  const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";

  if (agentId === "main") {
    return join(openclawDir, "workspace", "memory");
  }

  // Other agents use workspace-{id}/memory
  return join(openclawDir, `workspace-${agentId}`, "memory");
}

// Get STATUS.md for a project
function getProjectStatus(agentId: string): { project: string; content: string } | null {
  const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
  const workspaceDir = agentId === "main"
    ? join(openclawDir, "workspace")
    : join(openclawDir, `workspace-${agentId}`);

  const projectsDir = join(workspaceDir, "projects");
  try {
    const projects = readdirSync(projectsDir);
    for (const project of projects) {
      const statusPath = join(projectsDir, project, "STATUS.md");
      try {
        const content = readFileSync(statusPath, "utf-8");
        return { project, content };
      } catch {
        // No STATUS.md for this project
      }
    }
  } catch {
    // No projects directory
  }
  return null;
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId") || "main";
  const date = req.nextUrl.searchParams.get("date"); // Optional: specific date

  try {
    const memoryDir = getMemoryDir(agentId);
    const entries: DiaryEntry[] = [];

    const files = readdirSync(memoryDir)
      .filter((f) => f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}/.test(f))
      .sort()
      .reverse(); // Most recent first

    for (const file of files) {
      const fileDate = file.replace(".md", "");

      // If specific date requested, only return that one
      if (date && !fileDate.startsWith(date)) continue;

      const filePath = join(memoryDir, file);
      const stat = statSync(filePath);
      const content = readFileSync(filePath, "utf-8");

      entries.push({
        date: fileDate,
        content,
        sizeBytes: stat.size,
        estimatedTokens: Math.round(stat.size / 4),
      });
    }

    // Get project status
    const projectStatus = getProjectStatus(agentId);

    return NextResponse.json({
      agentId,
      entries,
      projectStatus,
      totalEntries: entries.length,
      totalTokens: entries.reduce((sum, e) => sum + e.estimatedTokens, 0),
    });
  } catch (error: any) {
    // Memory directory doesn't exist yet — that's fine
    if (error.code === "ENOENT") {
      return NextResponse.json({
        agentId,
        entries: [],
        projectStatus: getProjectStatus(agentId),
        totalEntries: 0,
        totalTokens: 0,
      });
    }

    console.error("Error reading diary:", error);
    return NextResponse.json(
      { error: "Failed to read diary" },
      { status: 500 }
    );
  }
}
