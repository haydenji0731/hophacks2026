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
    "irs", "ssa", "fbi", "bank", "amex", "chase", "microsoft", "apple", "usps", "fedex", "dhl", "insurance", "law firm", "immigration", "utility", "medicare", "nypd", "meta support", "tech support", "warranty", "ceo", "vendor",
  ]);
}

function urgency(scam: Scam): boolean {
  if (
    tagMatch(scam, {
      hooks: ["urgency", "arrest_threat", "secrecy", "family_crisis", "service_shutoff", "fear"],
      signals: ["keep_it_secret", "threatens_arrest", "pay_within_minutes"],
    })
  ) {
    return true;
  }
  return hasAny(blob(scam), [
    "urgency", "secrecy", "secret", "warrant", "arrest", "shutoff", "immediately", "deportation", "bail", "emergency", "threat", "pressure", "stay on line",
  ]);
}

function remoteOrCode(scam: Scam): boolean {
  if (
    tagMatch(scam, {
      asks: ["otp_code", "otp", "remote_access", "password", "seed_phrase", "wallet_connect"],
    })
  ) {
    return true;
  }
  return hasAny(blob(scam), [
    "otp", "remote access", "anydesk", "teamviewer", "seed phrase", "password", "verification", "2fa", "login", "borrow phone", "call forwarding", "sim swap", "token",
  ]);
}
