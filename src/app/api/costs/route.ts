import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  getDatabase,
  getCostSummary,
  getCostByAgent,
  getCostByModel,
  getDailyCost,
  getHourlyCost,
} from "@/lib/usage-queries";
import path from "path";
import fs from "fs";

// Look for the usage DB under OPENCLAW_DIR, fallback to project data dir
function getDbPath(): string {
  const openclawDir = process.env.OPENCLAW_DIR || path.join(process.env.HOME || "/root", ".openclaw");
  // Check common locations
  const candidates = [
    path.join(openclawDir, "data", "usage-tracking.db"),
    path.join(openclawDir, "usage-tracking.db"),
    path.join(process.cwd(), "data", "usage-tracking.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // default (getDatabase will handle missing)
}

const DB_PATH = getDbPath();
const DEFAULT_BUDGET = 100.0; // Default budget in USD

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";

  // Parse timeframe to days
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;

  try {
    let db;
    try {
      db = getDatabase(DB_PATH);
    } catch (dbErr) {
      console.warn("Could not open usage DB:", dbErr);
      db = null;
    }

    if (!db) {
      // Database doesn't exist yet - return zeros gracefully
      return NextResponse.json({
        today: 0,
        yesterday: 0,
        thisMonth: 0,
        lastMonth: 0,
        projected: 0,
        budget: DEFAULT_BUDGET,
        byAgent: [],
        byModel: [],
        daily: [],
        hourly: [],
        message: "No usage data collected yet.",
      });
    }

    // Get all the data
    const summary = getCostSummary(db);
    const byAgent = getCostByAgent(db, days);
    const byModel = getCostByModel(db, days);
    const daily = getDailyCost(db, days);
    const hourly = getHourlyCost(db);

    db.close();

    return NextResponse.json({
      ...summary,
      budget: DEFAULT_BUDGET,
      byAgent,
      byModel,
      daily,
      hourly,
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    // Graceful degradation — return empty data instead of 500
    return NextResponse.json({
      today: 0,
      yesterday: 0,
      thisMonth: 0,
      lastMonth: 0,
      projected: 0,
      budget: DEFAULT_BUDGET,
      byAgent: [],
      byModel: [],
      daily: [],
      hourly: [],
      message: "Failed to fetch cost data. DB may not exist yet.",
    });
  }
}

// POST endpoint to update budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, alerts } = body;

    // In production, save to database
    // For now, just return success
    
    return NextResponse.json({
      success: true,
      budget,
      alerts,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}
