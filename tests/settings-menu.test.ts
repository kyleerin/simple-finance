import assert from "node:assert/strict";
import { test } from "node:test";
import { showAppSettings } from "../lib/settings";

test("Settings stays hidden on login and visible on signed-in routes", () => {
  assert.equal(showAppSettings("/login"), false);
  assert.equal(showAppSettings("/"), true);
  assert.equal(showAppSettings("/activity"), true);
  assert.equal(showAppSettings("/budget"), true);
  assert.equal(showAppSettings(null), true);
});
