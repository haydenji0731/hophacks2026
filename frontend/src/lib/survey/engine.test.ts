import { describe, expect, it } from "vitest";
import {
  SCAMS,
  rankScams,
  selectNextQuestion,
  shouldStop,
} from "./engine";
import { profileFromAnswers } from "./profile";
import { detectorReportPayload } from "./backend-report";
import { SKIP } from "./types";

function topSlug(answers: { questionId: string; value: string }[]) {
  return rankScams(answers)[0]?.scam.slug;
}

function topSlugs(answers: { questionId: string; value: string }[], n = 5) {
  return rankScams(answers)
    .slice(0, n)
    .map((row) => row.scam.slug);
}

describe("scam corpus", () => {
  it("loads the seed corpus plus e-dating and cashier-check patterns", () => {
    expect(SCAMS.length).toBeGreaterThanOrEqual(98);
    expect(SCAMS.some((scam) => scam.slug === "e_dating_money_request")).toBe(true);
    expect(SCAMS.some((scam) => scam.slug === "cashier_check_overpayment")).toBe(true);
    const marketplace = SCAMS.find((scam) => scam.slug === "facebook_marketplace_payment_scam");
    expect(marketplace?.victimRoles).toEqual(
      expect.arrayContaining(["marketplace buyer", "marketplace seller"])
    );
    expect(marketplace?.victimRoles).not.toContain("{");
    expect(marketplace?.examples?.length).toBeGreaterThan(0);
  });

  it("merges catalog methods without duplicating existing slugs", () => {
    const catalogIds = SCAMS.flatMap((scam) => scam.catalogIds ?? []);
    expect(new Set(catalogIds).size).toBe(60);
    expect(catalogIds).toHaveLength(60);
    expect(SCAMS.filter((scam) => scam.origin === "grok")).toHaveLength(19);
    expect(SCAMS.some((scam) => scam.slug === "irs_tax")).toBe(false);
    expect(SCAMS.some((scam) => scam.catalogIds?.includes("irs_tax"))).toBe(true);
    expect(SCAMS.find((scam) => scam.slug === "irs_ssa_tax_impersonation")?.catalogIds).toContain(
      "irs_tax"
    );
    expect(SCAMS.some((scam) => scam.slug === "ssa_freeze")).toBe(true);
    expect(SCAMS.some((scam) => scam.slug === "jury_duty_warrant")).toBe(true);
    expect(SCAMS.some((scam) => scam.slug === "chinese_embassy_customs")).toBe(true);
    expect(SCAMS.every((scam) => scam.tags?.channels && scam.tags.hooks && scam.tags.asks)).toBe(
      true
    );
  });
});

describe("adaptive ranking", () => {
  it("asks how they arrived first", () => {
    expect(selectNextQuestion([])?.id).toBe("source");
  });

  it("ranks IRS gift-card pressure as tax impersonation", () => {
    const answers = [
      { questionId: "source", value: "phone" },
      { questionId: "notify_about", value: "government" },
      { questionId: "ask_value", value: "yes" },
      { questionId: "demand", value: "gift_card" },
      { questionId: "impersonation", value: "yes" },
      { questionId: "urgency", value: "yes" },
    ];
    expect(topSlugs(answers)).toContain("irs_ssa_tax_impersonation");
  });

  it("ranks a fake job training fee", () => {
    const answers = [
      { questionId: "channel", value: "web" },
      { questionId: "theme", value: "job" },
      { questionId: "ask_value", value: "yes" },
      { questionId: "demand", value: "wire" },
      { questionId: "details", value: "they said I have to buy training equipment and a background check" },
    ];
    expect(topSlug(answers)).toBe("job_offer_training_equipment_fee");
  });

  it("ranks marketplace off-platform payment", () => {
    const answers = [
      { questionId: "channel", value: "web" },
      { questionId: "theme", value: "marketplace" },
      { questionId: "ask_value", value: "yes" },
      { questionId: "details", value: "facebook marketplace buyer wants to pay off platform shipping" },
    ];
    expect(topSlug(answers)).toBe("facebook_marketplace_payment_scam");
  });

  it("ranks e-dating money requests", () => {
    const answers = [
      { questionId: "source", value: "extension" },
      { questionId: "channel", value: "chat" },
      { questionId: "theme", value: "romance" },
      { questionId: "ask_value", value: "yes" },
      { questionId: "demand", value: "wire" },
      {
        questionId: "details",
        value: "hinge tinder e-dating love bombing whatsapp hospital ticket money",
      },
    ];
    expect(topSlugs(answers, 4)).toContain("e_dating_money_request");
  });

  it("ranks cashier's-check overpayment", () => {
    const answers = [
      { questionId: "theme", value: "marketplace" },
      { questionId: "ask_value", value: "yes" },
      { questionId: "demand", value: "check" },
      {
        questionId: "details",
        value: "cashiers check overpayment refund the extra before it clears",
      },
    ];
    expect(
      topSlugs(answers, 3).some((slug) =>
        ["cashier_check_overpayment", "marketplace_overpayment_fake_check"].includes(slug)
      )
    ).toBe(true);
  });

  it("treats skip as no evidence, not a mismatch", () => {
    const withSkip = rankScams([
      { questionId: "channel", value: "phone" },
      { questionId: "age", value: SKIP },
      { questionId: "impersonation", value: SKIP },
    ]);
    const without = rankScams([{ questionId: "channel", value: "phone" }]);
    expect(withSkip[0].scam.slug).toBe(without[0].scam.slug);
  });

  it("skips payment-type after the user said no money was asked", () => {
    const next = selectNextQuestion([
      { questionId: "source", value: "own" },
      { questionId: "age", value: "adult" },
      { questionId: "ask_value", value: "no" },
    ]);
    expect(next?.id).not.toBe("demand");
  });

  it("stops once the top candidate is clearly ahead", () => {
    const answers = [
      { questionId: "source", value: "own" },
      { questionId: "age", value: "adult" },
      { questionId: "channel", value: "phone" },
      { questionId: "theme", value: "government" },
      { questionId: "ask_kind", value: "payment" },
      { questionId: "hook_who", value: "government" },
      { questionId: "gov_detail", value: "irs" },
      { questionId: "demand", value: "gift_card" },
      { questionId: "urgency", value: "yes" },
    ];
    expect(shouldStop(answers, rankScams(answers))).toBe(true);
  });

  it("delegates SSA freeze vs IRS vs jury duty on the government branch", () => {
    const base = [
      { questionId: "source", value: "phone" },
      { questionId: "notify_about", value: "government" },
      { questionId: "ask_kind", value: "payment" },
      { questionId: "hook_who", value: "government" },
    ];
    expect(topSlug([...base, { questionId: "gov_detail", value: "ssa" }])).toBe("ssa_freeze");
    expect(topSlug([...base, { questionId: "gov_detail", value: "jury" }])).toBe("jury_duty_warrant");
    expect(topSlugs([...base, { questionId: "gov_detail", value: "irs" }])).toContain(
      "irs_ssa_tax_impersonation"
    );
  });

  it("delegates package vs toll vs bank-alert texts", () => {
    const base = [
      { questionId: "channel", value: "sms" },
      { questionId: "ask_kind", value: "fee" },
    ];
    expect(topSlug([...base, { questionId: "sms_detail", value: "package" }])).toBe(
      "parcel_customs_delivery_fee"
    );
    expect(topSlug([...base, { questionId: "sms_detail", value: "toll" }])).toBe("toll_road_text_phish");
    expect(topSlug([...base, { questionId: "sms_detail", value: "bank" }])).toBe("bank_fraud_alert_sms");
  });

  it("splits pig-butchering from classic e-dating money requests", () => {
    const base = [
      { questionId: "hook_who", value: "romance" },
      { questionId: "theme", value: "romance" },
    ];
    expect(topSlug([...base, { questionId: "romance_detail", value: "crypto_dash" }])).toBe(
      "pig_butchering_crypto_romance"
    );
    expect(topSlug([...base, { questionId: "romance_detail", value: "travel_money" }])).toBe(
      "e_dating_money_request"
    );
  });

  it("asks the government discriminator after a government hook", () => {
    const next = selectNextQuestion([
      { questionId: "source", value: "phone" },
      { questionId: "age", value: "adult" },
      { questionId: "notify_about", value: "government" },
      { questionId: "ask_kind", value: "payment" },
      { questionId: "hook_who", value: "government" },
    ]);
    expect(next?.id).toBe("gov_detail");
  });

  it("marks under-18 and 55+ as simplified", () => {
    expect(profileFromAnswers([{ questionId: "age", value: "child" }]).simplified).toBe(true);
    expect(profileFromAnswers([{ questionId: "age", value: "older" }]).simplified).toBe(true);
    expect(profileFromAnswers([{ questionId: "age", value: "adult" }]).simplified).toBe(false);
    expect(profileFromAnswers([{ questionId: "age", value: SKIP }]).simplified).toBe(false);
  });

  it("ranks a code / remote-access ask from the merged access option", () => {
    const answers = [
      { questionId: "channel", value: "sms" },
      { questionId: "ask_kind", value: "access" },
      { questionId: "sms_detail", value: "otp" },
    ];
    expect(topSlug(answers)).toBe("whatsapp_otp_code_share");
  });

  it("ranks tech support from the company hook", () => {
    const answers = [
      { questionId: "channel", value: "web" },
      { questionId: "ask_kind", value: "access" },
      { questionId: "hook_who", value: "company" },
      { questionId: "tech_detail", value: "popup" },
    ];
    expect(topSlugs(answers)).toContain("tech_support_remote_access");
  });

  it("maps a confirmation onto the existing detector report payload", () => {
    const payload = detectorReportPayload(SCAMS.find((scam) => scam.slug === "ssa_freeze")!, [
      { questionId: "source", value: "phone" },
      { questionId: "demand", value: "gift_card" },
      { questionId: "hook_who", value: "government" },
    ]);
    expect(payload.scam_type).toMatch(/Social Security/i);
    expect(payload.platform).toBe("phone");
    expect(payload.method).toBe("gift card payment request");
    expect(payload.target).toBe("general consumer");
  });
});
