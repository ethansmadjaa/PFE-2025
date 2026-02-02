import { NextRequest, NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

// GET /api/remix/[jobId]/download - Download remixed audio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const response = await fetch(`${backendUrl}/remix/${jobId}/download`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || "Failed to download remix" },
        { status: response.status }
      );
    }

    const audioBlob = await response.blob();

    return new NextResponse(audioBlob, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="remix.wav"',
      },
    });
  } catch (error) {
    console.error("Error downloading remix:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 500 }
    );
  }
}
