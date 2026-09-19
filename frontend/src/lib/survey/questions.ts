import type { Question, Scam } from "./types";
import { exclusiveMethodMatch, exclusiveTagMatch, hasTag, tagMatch } from "./tags";
import { blob, hasAny } from "./text";

function moneyDemands(scam: Scam): boolean {
  return scam.demands.some((demand) => demand !== "other");
}

function impersonation(scam: Scam): boolean {
  if (
    tagMatch(scam, {
      hooks: [
        "government_impersonation",
        "brand_impersonation",
        "fraud_alert",
        "virus_warning",
        "arrest_threat",
        "court_authority",
        "police_authority",
      ],
    })
  ) {
    return true;
  }
  return hasAny(blob(scam), [
    "irs",
    "ssa",
    "fbi",
    "bank",
    "amex",
    "chase",
    "microsoft",
    "apple",
    "usps",
    "fedex",
    "dhl",
    "insurance",
    "law firm",
    "immigration",
    "utility",
    "medicare",
    "nypd",
    "meta support",
    "tech support",
    "warranty",
    "ceo",
    "vendor",
  ]);
}
