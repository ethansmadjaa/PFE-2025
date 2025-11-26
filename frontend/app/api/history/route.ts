import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// GET: Load history from JSON file
export async function GET() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(HISTORY_FILE, "utf-8");
    return new NextResponse(data, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist yet, return empty array
      return new NextResponse("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }
}

// POST: Save history to JSON file
export async function POST(request: NextRequest) {
  try {
    await ensureDataDir();
    const body = await request.text();

    // Validate JSON
    JSON.parse(body);

    await fs.writeFile(HISTORY_FILE, body, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save history:", error);
    return NextResponse.json(
      { error: "Failed to save history" },
      { status: 500 }
    );
  }
}

// DELETE: Clear history file
export async function DELETE() {
  try {
    await ensureDataDir();
    await fs.writeFile(HISTORY_FILE, "[]", "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear history:", error);
    return NextResponse.json(
      { error: "Failed to clear history" },
      { status: 500 }
    );
  }
}
