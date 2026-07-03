import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";

// Client-upload token endpoint for @vercel/blob. The browser uploads the file
// directly to Blob storage (bypassing the Next.js function body-size limit) and
// calls this route only to obtain a short-lived signed token. Requires
// BLOB_READ_WRITE_TOKEN to be set (Vercel Blob); without it, uploads fail.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // Gate token issuance on an authenticated user with an active farm.
    await requireActiveFarmApi();

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        addRandomSuffix: true,
      }),
      // No-op: we persist the returned URL when the form is submitted, not here.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    // Surface auth failures as 403; anything else (e.g. missing token) as 400.
    try {
      return handleApiError(err);
    } catch {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Nepavyko įkelti" },
        { status: 400 }
      );
    }
  }
}
