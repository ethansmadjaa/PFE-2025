import { NextRequest, NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

// POST /api/sample - Create a new job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${backendUrl}/sample`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to create job" },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    console.error("Error proxying to backend:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 500 }
    );
  }
}
