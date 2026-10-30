import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPrivateAccess, isAllowedEmail } from "../lib/access";

const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;

test("private gate fails closed without configuration or credentials", () => {
  assert.equal(hasPrivateAccess(null, "secret"), false);
  assert.equal(hasPrivateAccess(basic("owner:secret"), undefined), false);
  assert.equal(hasPrivateAccess(basic("owner:"), ""), false);
});

test("private gate requires both correct username and password", () => {
  assert.equal(hasPrivateAccess(basic("owner:secret"), "secret"), true);
  assert.equal(hasPrivateAccess(basic("other:secret"), "secret"), false);
  assert.equal(hasPrivateAccess(basic("owner:wrong"), "secret"), false);
  assert.equal(hasPrivateAccess("Bearer secret", "secret"), false);
  assert.equal(hasPrivateAccess("Basic !!!", "secret"), false);
  assert.equal(hasPrivateAccess(basic("owner:with:colon"), "with:colon"), true);
});

test("owner allowlist requires an exact email, ignoring case and whitespace", () => {
  assert.equal(isAllowedEmail("Owner@Example.com", " owner@example.com "), true);
  assert.equal(isAllowedEmail("other@example.com", "owner@example.com"), false);
  assert.equal(isAllowedEmail("owner@example.com.attacker.test", "owner@example.com"), false);
  assert.equal(isAllowedEmail(undefined, "owner@example.com"), false);
  assert.equal(isAllowedEmail("owner@example.com", ""), false);
});
