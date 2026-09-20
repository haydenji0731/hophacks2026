import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze } from "../src/index";
import fixturesJson from "./fixtures.json";

type Fixture = {
  id: string;
  text: string;
  expectedBand: "ok" | "caution" | "high";
  mustIncludeReason?: string;
};

const fixtures = fixturesJson as Fixture[];

describe("scam-smell analyze", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} → ${fixture.expectedBand}`, () => {
      const result = analyze(fixture.text);
      assert.equal(
        result.band,
        fixture.expectedBand,
        `${fixture.id} scored ${result.score} (${result.band}) reasons=${result.reasons.join(" | ")}`,
      );
      if (fixture.mustIncludeReason) {
        const blob = `${result.reasons.join(" ")} ${result.category}`.toLowerCase();
        assert.ok(
          blob.includes(fixture.mustIncludeReason.toLowerCase()) ||
            result.reasons.some((r) => r.toLowerCase().includes(fixture.mustIncludeReason!.toLowerCase())),
          `${fixture.id} missing reason ${fixture.mustIncludeReason}: ${result.reasons.join(" | ")}`,
        );
      }
      if (fixture.expectedBand === "ok") {
        assert.equal(result.reasons.length, 0);
        assert.equal(result.highlights.length, 0);
      } else {
        assert.ok(result.reasons.length > 0 && result.reasons.length <= 3);
        assert.ok(result.score >= (fixture.expectedBand === "high" ? 55 : 25));
      }
    });
  }

  it("is offline and deterministic", () => {
    const a = analyze("Click to verify your account");
    const b = analyze("Click to verify your account");
    assert.deepEqual(a, b);
  });

  it("decodes leetspeak passwords", () => {
    const result = analyze("Confirm your p@ssw0rd and send me the code now");
    assert.ok(result.score >= 25, `leetspeak score ${result.score}`);
  });
});
