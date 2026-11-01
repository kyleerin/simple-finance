import { NextResponse } from "next/server";
import { getOwner } from "../../../lib/owner";
import { parseSpending } from "../../../lib/spending";
import { saveSpending } from "../../../lib/save-spending";

export async function POST(request: Request) {
  // JSON requires a CORS preflight from other origins; do not accept simple
  // cross-origin form/text submissions to this cookie-authenticated endpoint.
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "JSON content type required." }, { status: 415 });
  }
  const owner = await getOwner();
  if (!owner) return NextResponse.json({ error: "Your session expired. Sign in again in another tab, then retry here." }, { status: 401 });
  let input: ReturnType<typeof parseSpending>;
  try { input = parseSpending(await request.json()); }
  catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid request." : (error as Error).message }, { status: 400 });
  }
  const result = await saveSpending(owner.supabase, owner.user.id, input);
  return NextResponse.json(result, {
    status: result.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
