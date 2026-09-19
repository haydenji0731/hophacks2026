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
    "urgency",
    "secrecy",
    "secret",
    "warrant",
    "arrest",
    "shutoff",
    "immediately",
    "deportation",
    "bail",
    "emergency",
    "threat",
    "pressure",
    "stay on line",
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
    "otp",
    "remote access",
    "anydesk",
    "teamviewer",
    "seed phrase",
    "password",
    "verification",
    "2fa",
    "login",
    "borrow phone",
    "call forwarding",
    "sim swap",
    "token",
  ]);
}

const THEME_TAGS: Record<string, Parameters<typeof tagMatch>[1]> = {
  job: {
    hooks: ["easy_money", "remote_work", "work_from_home", "brand_employer"],
    asks: ["upfront_fee", "receive_and_forward_money", "deposit_own_money"],
  },
  marketplace: {
    channels: ["marketplace"],
    asks: ["deposit_before_viewing", "fake_check", "zelle", "venmo"],
  },
  romance: {
    hooks: ["romance", "love_bombing", "friendship", "wrong_number"],
  },
  package: {
    hooks: ["delivery_problem", "customs_parcel"],
  },
  account: {
    asks: ["otp_code", "otp", "password", "seed_phrase", "remote_access"],
    hooks: ["account_locked", "account_hacked", "account_compromise"],
  },
  family: {
    hooks: ["family_crisis", "secrecy", "ai_voice", "friend_impersonation"],
  },
  investment: {
    hooks: ["investment_opportunity", "high_returns", "fomo"],
    asks: ["cryptocurrency_deposit", "wallet_connect"],
  },
  government: {
    hooks: [
      "government_impersonation",
      "arrest_threat",
      "loan_forgiveness",
      "benefits_threat",
      "court_authority",
      "service_shutoff",
    ],
  },
};

const THEME_KEYWORDS: Record<string, string[]> = {
  job: ["job", "training", "recruiter", "mystery shopper", "mule", "work from home", "watch to earn", "handmade", "reseller"],
  marketplace: [
    "marketplace",
    "rental",
    "ticket",
    "ebay",
    "paypal friends",
    "auction",
    "pet sale",
    "vehicle",
    "shipping label",
    "overpayment",
    "cashier",
  ],
  romance: ["romance", "dating", "e-dating", "e_dating", "sugar", "pig butchering", "sextortion", "wrong number", "tinder"],
  package: ["parcel", "delivery", "usps", "fedex", "brushing", "unordered package", "customs"],
  account: ["account", "otp", "phish", "login", "instagram", "sim swap", "captcha", "wallet", "recovery"],
  family: ["family", "grandma", "grandson", "jail", "bail", "parent mil", "elderly", "courier"],
  investment: ["investment", "crypto trading", "pig butchering", "trading app", "mentor", "giveaway", "recovery agent"],
  government: ["irs", "ssa", "fbi", "tax", "immigration", "utility", "student loan", "arrest warrant", "law firm", "medicare"],
};

function themeMatch(scam: Scam, value: string): boolean | null {
  if (value === "other") return null;
  const spec = THEME_TAGS[value];
  const keys = THEME_KEYWORDS[value];
  const tagHit = spec ? tagMatch(scam, spec) : false;
  const keyHit = keys ? hasAny(blob(scam), keys) : false;
  if (tagHit || keyHit) return true;
  const sibling = Object.keys(THEME_TAGS).some((id) => {
    if (id === value) return false;
    const otherSpec = THEME_TAGS[id];
    const otherKeys = THEME_KEYWORDS[id];
    return (otherSpec && tagMatch(scam, otherSpec)) || (otherKeys && hasAny(blob(scam), otherKeys));
  });
  return sibling ? false : null;
}

function channelOf(answers: Record<string, string>): string {
  if (answers.source === "phone") return "phone";
  return answers.channel ?? "";
}

function themeOf(answers: Record<string, string>): string {
  if (answers.notify_about && answers.notify_about !== "skip") return answers.notify_about;
  return answers.theme ?? "";
}

const CHANNEL_TAGS: Record<string, Parameters<typeof tagMatch>[1]> = {
  phone: { channels: ["phone", "robocall"] },
  sms: { channels: ["sms"] },
  chat: { channels: ["messaging_app"] },
  social: { channels: ["social_dm", "comments"] },
  dating: { channels: ["dating_app"] },
  marketplace: { channels: ["marketplace"] },
  web: { channels: ["email", "search", "popup", "ads", "search_ad"] },
  qr: { channels: ["qr_code"] },
  in_person: { channels: ["in_person", "mail", "door_to_door", "qr_code"] },
};

function channelFallback(scam: Scam, value: string): boolean | null {
  const text = blob(scam);
  switch (value) {
    case "phone":
      return scam.platforms.includes("phone");
    case "sms":
      return scam.platforms.includes("sms");
    case "discord":
      return scam.platforms.includes("discord") || text.includes("discord");
    case "web":
      return scam.platforms.includes("web");
    case "chat":
    case "social":
    case "dating":
      return (
        hasAny(text, ["whatsapp", "telegram", "tiktok", "wrong number", "dating", "instagram"]) ||
        (scam.platforms.includes("other") && !scam.platforms.includes("phone") && !scam.platforms.includes("web"))
      );
    case "marketplace":
      return hasAny(text, ["marketplace", "rental", "ebay", "craigslist"]);
    case "qr":
    case "in_person":
      return hasAny(text, ["atm", "bus stop", "meetup", "courier", "parking", "skimmer", "in store", "retail", "windshield", "qr"]);
    default:
      return null;
  }
}
