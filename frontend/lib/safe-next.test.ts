import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("safeNext keeps local paths and rejects every off-site form", () => {
  assert.equal(safeNext("/dashboard?plan=plus&period=yearly"), "/dashboard?plan=plus&period=yearly");
  assert.equal(safeNext("/deals#x"), "/deals#x");
  assert.equal(safeNext(null), "/dashboard");
  for (const bad of ["//evil.example", "/\\evil.example", "\\\\evil.example", "/\t/evil.example", "https://evil.example/", "javascript:alert(1)", " //evil.example"])
    assert.equal(safeNext(bad), "/dashboard", bad);
  // These resolve to local paths; what matters is that none can turn protocol-relative.
  for (const sneaky of ["/.//evil.example", "/x/..//evil.example", "/%2f/evil.example", "http:evil.example", "/\\/evil.example"]) {
    const r = safeNext(sneaky);
    assert.ok(r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/\\"), `${sneaky} -> ${r}`);
  }
});
