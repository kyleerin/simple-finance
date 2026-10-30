import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasPrivateAccess } from "./lib/access";

export async function proxy(request: NextRequest) {
  if (!process.env.PRIVATE_ACCESS_PASSWORD) {
    return new NextResponse("Private access is not configured.", { status: 503 });
  }
  if (
    !hasPrivateAccess(
      request.headers.get("authorization"),
      process.env.PRIVATE_ACCESS_PASSWORD,
    )
  ) {
    return new NextResponse("Private app. Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Simple Finance", charset="UTF-8"' },
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.ALLOWED_EMAIL?.trim()) {
    return new NextResponse("Application setup is incomplete.", { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Validate/refresh the session before rendering, including action requests.
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
