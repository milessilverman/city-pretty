import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

// pipeline/test_antimeridian.py: synthetic block groups on both sides of the 180th meridian (Aleutians West, 02016):
// download boxes, nearest-distance maths and cell keys; and that a county that does not cross 180 keeps its old boxes.
describe("county pipeline, county crossing the 180th meridian", () => {
  it("passes pipeline/test_antimeridian.py", () => {
    const r = spawnSync("python3", ["-W", "ignore", path.join(root, "pipeline/test_antimeridian.py")], { encoding: "utf8" });
    expect(r.stderr + r.stdout).toMatch(/OK/);
    expect(r.status).toBe(0);
  });
});
