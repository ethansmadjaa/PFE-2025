import { NextRequest, NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

// GET /api/sample/[jobId]/download - Download completed sample pack
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const response = await fetch(`${backendUrl}/sample/${jobId}/download`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || "Failed to download sample pack" },
        { status: response.status }
      );
    }

    const zipBlob = await response.blob();

    return new NextResponse(zipBlob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="sample_pack.zip"',
      },
    });
  } catch (error) {
    console.error("Error downloading sample pack:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend" },
      { status: 500 }
    );
  }
}
