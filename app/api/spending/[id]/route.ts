import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getOwner } from "../../../../lib/owner";
import { isUuid, parseSpending } from "../../../../lib/spending";
import { changeSpending } from "../../../../lib/manage-spending";

async function mutate(request: Request, context: { params: Promise<{ id: string }> }, deleting: boolean) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "JSON content type required." }, { status: 415 });
  }
  const owner = await getOwner();
  if (!owner) return NextResponse.json({ error: "Session expired. Sign in in another tab, then retry here." }, { status: 401 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  let input: ReturnType<typeof parseSpending> | undefined;
  let version: number;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid request.");
    version = body.version;
    if (!Number.isSafeInteger(version) || version < 0) throw new Error("Invalid version. Reload the purchase.");
    if (!deleting) input = parseSpending({ ...body, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid request." : (error as Error).message }, { status: 400 });
  }
  const result = await changeSpending(owner.supabase, owner.user.id, id, version, input ?? null);
  if (result.saved) revalidatePath("/", "layout");
  return NextResponse.json(result, { status: result.status ?? 200, headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutate(request, context, false);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutate(request, context, true);
}
