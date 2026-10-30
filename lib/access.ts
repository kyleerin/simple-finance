import { createHash, timingSafeEqual } from "node:crypto";

function equalSecret(actual: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export function hasPrivateAccess(
  authorization: string | null,
  password: string | undefined,
): boolean {
  if (!password || !authorization?.startsWith("Basic ")) return false;
  const credentials = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  return equalSecret(credentials, `owner:${password}`);
}

export function isAllowedEmail(
  email: string | undefined,
  allowedEmail: string | undefined,
): boolean {
  if (!email || !allowedEmail?.trim()) return false;
  return email.trim().toLowerCase() === allowedEmail.trim().toLowerCase();
}
