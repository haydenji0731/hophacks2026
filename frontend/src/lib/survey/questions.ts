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
  chat: { channels: ["messaging_app", "social_dm", "comments", "dating_app"] },
  marketplace: { channels: ["marketplace"] },
  web: { channels: ["email", "search", "popup", "ads", "search_ad"] },
  in_person: { channels: ["in_person", "mail", "door_to_door", "qr_code"] },
};

function channelFallback(scam: Scam, value: string): boolean | null {
  const text = blob(scam);
  switch (value) {
    case "phone":
      return scam.platforms.includes("phone");
    case "sms":
      return scam.platforms.includes("sms");
    case "web":
      return scam.platforms.includes("web");
    case "chat":
      return (
        scam.platforms.includes("discord") ||
        hasAny(text, ["whatsapp", "telegram", "tiktok", "wrong number", "dating", "instagram", "discord"]) ||
        (scam.platforms.includes("other") && !scam.platforms.includes("phone") && !scam.platforms.includes("web"))
      );
    case "marketplace":
      return hasAny(text, ["marketplace", "rental", "ebay", "craigslist"]);
    case "in_person":
      return hasAny(text, ["atm", "bus stop", "meetup", "courier", "parking", "skimmer", "in store", "retail", "windshield", "qr"]);
    default:
      return null;
  }
}

const ASK_TAGS: Record<string, Parameters<typeof tagMatch>[1]> = {
  payment: {
    asks: ["gift_card", "wire_transfer", "cryptocurrency", "cryptocurrency_deposit", "payment_app", "wire"],
  },
  safe_account: { asks: ["transfer_funds"], signals: ["safe_account_story"] },
  access: {
    asks: [
      "otp_code",
      "otp",
      "verification_code",
      "remote_access",
      "password",
      "seed_phrase",
      "private_key",
      "fsa_id",
      "wallet_connect",
      "transaction_signature",
    ],
  },
  fee: {
    asks: ["upfront_fee", "deposit_before_viewing", "advance_fee", "deposit", "shipping_fee", "click_link", "payment_card", "card_details"],
  },
  ids: { asks: ["ssn", "medicare_number", "personal_info", "personal_id"] },
  mule: { asks: ["receive_and_forward_money", "open_accounts"] },
};

const HOOK_TAGS: Record<string, Parameters<typeof tagMatch>[1]> = {
  government: {
    hooks: [
      "government_impersonation",
      "arrest_threat",
      "court_authority",
      "police_authority",
      "benefits_threat",
      "loan_forgiveness",
      "customs_parcel",
    ],
  },
  bank: { hooks: ["fraud_alert", "account_compromise", "lower_interest"] },
  company: {
    hooks: [
      "brand_impersonation",
      "virus_warning",
      "unauthorized_charge",
      "warranty_expiring",
      "service_shutoff",
      "wallet_error",
      "support_help",
      "need_support",
    ],
  },
  romance: { hooks: ["romance", "love_bombing", "wrong_number", "friendship"] },
  job: { hooks: ["easy_money", "remote_work", "brand_employer", "work_from_home"] },
  marketplace: { hooks: ["below_market_rent", "local_deal", "cute_pet", "overpayment"] },
  prize: { hooks: ["prize", "unexpected_wealth", "free_tokens", "celebrity", "free_vacation"] },
  family: { hooks: ["family_crisis", "ai_voice", "friend_impersonation"] },
};

function reasonIf(scam: Scam, value: string, matcher: Question["matches"], label: string): string | null {
  return matcher(scam, value) ? label : null;
}

export const QUESTIONS: Question[] = [
  {
    id: "source",
    prompt: "How did you get here?",
    kind: "choice",
    priority: 1,
    options: [
      { id: "phone", label: "A text warned me about a phone call" },
      { id: "extension", label: "I was chatting or browsing" },
      { id: "own", label: "I came here on my own" },
    ],
    matches(scam, value) {
      if (value === "phone") {
        return scam.platforms.includes("phone") || scam.platforms.includes("sms") || hasTag(scam, "channels", ["phone", "robocall", "sms"]);
      }
      if (value === "extension") {
        return (
          scam.platforms.includes("web") ||
          scam.platforms.includes("discord") ||
          hasTag(scam, "channels", ["social_dm", "messaging_app", "dating_app", "email"]) ||
          hasAny(blob(scam), ["whatsapp", "telegram", "dating", "instagram", "tiktok"])
        );
      }
      return null;
    },
    reason(scam, value) {
      if (value === "phone" && this.matches(scam, value)) {
        return "Often starts on a call or a warning text";
      }
      if (value === "extension" && this.matches(scam, value)) {
        return "Often starts in chat, mail, or a website";
      }
      return null;
    },
  },
  {
    id: "age",
    prompt: "Which age group should we write for?",
    kind: "choice",
    priority: 2,
    options: [
      { id: "child", label: "Under 18" },
      { id: "adult", label: "18–54" },
      { id: "older", label: "55 or older" },
    ],
    matches: () => null,
  },
  {
    id: "notify_about",
    prompt: "What did they say this was about?",
    kind: "choice",
    priority: 3,
    skipIf: (answers) => answers.source !== "phone",
    options: [
      { id: "government", label: "A bank, the IRS, police, or a government office" },
      { id: "family", label: "A family emergency or relative in trouble" },
      { id: "account", label: "A virus, hacked account, or tech support" },
      { id: "package", label: "A package or delivery fee" },
      { id: "investment", label: "An investment, refund, or prize" },
      { id: "other", label: "Something else" },
    ],
    matches: themeMatch,
    reason(scam, value) {
      if (value === "other" || !this.matches(scam, value)) return null;
      return "Matches what the warning was about";
    },
  },
  {
    id: "evidence",
    prompt: "Want to add a copy of the conversation?",
    helper: "Paste or attach a text export. Files stay on this device.",
    kind: "upload",
    priority: 4,
    skipIf: (answers) =>
      answers.source !== "extension" && answers.channel !== "web" && answers.channel !== "chat",
    matches: () => null,
  },
  {
    id: "channel",
    prompt: "How did this start?",
    kind: "choice",
    priority: 5,
    skipIf: (answers) => answers.source === "phone",
    options: [
      { id: "phone", label: "A phone call" },
      { id: "sms", label: "A text message" },
      { id: "chat", label: "Chat, social, or a dating app" },
      { id: "marketplace", label: "A marketplace listing" },
      { id: "web", label: "Email, a website, or an ad" },
      { id: "in_person", label: "In person, mail, or a QR code" },
    ],
    matches: (scam, value) => exclusiveTagMatch(scam, value, CHANNEL_TAGS, channelFallback),
    reason(scam, value) {
      const labels: Record<string, string> = {
        phone: "Usually starts on a phone call",
        sms: "Often arrives as a text",
        chat: "Starts in chat, a DM, or a dating app",
        marketplace: "Starts on a listing",
        web: "Lives on the web, email, or an ad",
        in_person: "Has an in-person, mail, or QR step",
      };
      return this.matches(scam, value) ? labels[value] ?? null : null;
    },
  },
  {
    id: "theme",
    prompt: "What was it about?",
    kind: "choice",
    skipIf: (answers) => Boolean(answers.notify_about) && answers.notify_about !== "skip",
    options: [
      { id: "job", label: "A job or easy-money task" },
      { id: "marketplace", label: "Buying or selling something" },
      { id: "romance", label: "Dating or a new online friend" },
      { id: "package", label: "A package or delivery fee" },
      { id: "account", label: "An account lock or “verify now” warning" },
      { id: "family", label: "A family emergency" },
      { id: "investment", label: "An investment or guaranteed return" },
      { id: "government", label: "Taxes, benefits, police, a bank, or a utility" },
      { id: "other", label: "Something else" },
    ],
    matches: themeMatch,
    reason(scam, value) {
      if (value === "other" || !this.matches(scam, value)) return null;
      return `Fits the “${value}” pattern`;
    },
  },
];

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question])
) as Record<string, Question>;
