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
  {
    id: "ask_kind",
    prompt: "What did they mainly want from you?",
    kind: "choice",
    priority: 6,
    options: [
      { id: "payment", label: "Gift cards, a wire, crypto, or an app payment" },
      { id: "safe_account", label: "Move money to a “safe” account" },
      { id: "access", label: "A code, login, remote access, or wallet approval" },
      { id: "fee", label: "An upfront fee or deposit" },
      { id: "ids", label: "SSN, Medicare number, or other ID" },
      { id: "mule", label: "Receive and forward money or packages" },
      { id: "other", label: "Something else" },
    ],
    matches: (scam, value) => exclusiveTagMatch(scam, value, ASK_TAGS),
    reason(scam, value) {
      const labels: Record<string, string> = {
        payment: "Pushes an untraceable payment",
        safe_account: "Uses the “move it to a safe account” story",
        access: "Goes after codes, logins, remote access, or a wallet",
        fee: "Charges a fee before the prize, job, loan, or rental",
        ids: "Harvests SSN / Medicare / ID numbers",
        mule: "Wants you to move other people’s money or parcels",
      };
      return reasonIf(scam, value, this.matches, labels[value] ?? "Matches what they asked for");
    },
  },
  {
    id: "ask_value",
    prompt: "Did they ask you to send money, gift cards, crypto, or a payment?",
    kind: "yesno",
    skipIf: (answers) =>
      Boolean(answers.ask_kind) &&
      answers.ask_kind !== "skip" &&
      answers.ask_kind !== "other",
    matches(scam, value) {
      const asks = moneyDemands(scam) || hasTag(scam, "asks", ["gift_card", "wire_transfer", "cryptocurrency", "payment_app"]);
      return value === "yes" ? asks : !asks;
    },
    reason(scam, value) {
      if (value === "yes" && moneyDemands(scam)) {
        return `Typically demands ${scam.demands.filter((d) => d !== "other").join(", ") || "payment"}`;
      }
      if (value === "no" && !moneyDemands(scam)) {
        return "This pattern is usually after logins, codes, or access — not a payment";
      }
      return null;
    },
  },
  {
    id: "demand",
    prompt: "What did they want you to use?",
    kind: "choice",
    skipIf: (answers) =>
      answers.ask_value === "no" || ["access", "ids", "mule"].includes(answers.ask_kind),
    options: [
      { id: "gift_card", label: "Gift cards" },
      { id: "wire", label: "A bank wire" },
      { id: "crypto", label: "Bitcoin or another cryptocurrency" },
      { id: "cash", label: "Cash, Zelle, Venmo, Cash App, or PayPal" },
      { id: "check", label: "A cashier’s check or money order" },
    ],
    matches(scam, value) {
      if (value === "cash") {
        return (
          scam.demands.includes("cash") ||
          hasTag(scam, "asks", ["zelle", "venmo", "cashapp", "payment_app"]) ||
          hasAny(blob(scam), ["zelle", "venmo", "cashapp", "paypal", "apple pay"])
        );
      }
      if (value === "crypto") {
        return scam.demands.includes("crypto") || hasTag(scam, "asks", ["cryptocurrency", "cryptocurrency_deposit"]);
      }
      if (value === "wire") {
        return scam.demands.includes("wire") || hasTag(scam, "asks", ["wire_transfer"]);
      }
      if (value === "gift_card") {
        return scam.demands.includes("gift_card") || hasTag(scam, "asks", ["gift_card"]);
      }
      if (value === "check") {
        return scam.demands.includes("check") || hasTag(scam, "asks", ["fake_check"]);
      }
      return scam.demands.includes(value as Scam["demands"][number]);
    },
    reason(scam, value) {
      if (!this.matches(scam, value)) return null;
      return `Known to ask for ${value.replace("_", " ")}`;
    },
  },
  {
    id: "hook_who",
    prompt: "Who did they claim to be?",
    kind: "choice",
    priority: 7,
    options: [
      { id: "government", label: "IRS, Social Security, court, police, or an embassy" },
      { id: "bank", label: "My bank or credit-card company" },
      { id: "company", label: "A company I use, or “tech support”" },
      { id: "romance", label: "A romantic interest or new online friend" },
      { id: "job", label: "A recruiter or employer" },
      { id: "marketplace", label: "A buyer or seller" },
      { id: "prize", label: "A lottery, giveaway, or grant" },
      { id: "family", label: "A family member in trouble" },
      { id: "other", label: "Someone else" },
    ],
    matches: (scam, value) => exclusiveTagMatch(scam, value, HOOK_TAGS),
    reason(scam, value) {
      if (value === "other" || !this.matches(scam, value)) return null;
      return "Matches the impersonation / hook";
    },
  },
  {
    id: "gov_detail",
    prompt: "Which government story did they use?",
    kind: "choice",
    priority: 20,
    skipIf: (answers) => {
      const hook = answers.hook_who;
      const theme = themeOf(answers);
      return hook !== "government" && theme !== "government";
    },
    options: [
      { id: "irs", label: "Back taxes or the IRS" },
      { id: "ssa", label: "Social Security number or benefits frozen" },
      { id: "jury", label: "Missed jury duty or an arrest warrant" },
      { id: "embassy", label: "A parcel, embassy, or police detention" },
      { id: "utility", label: "Utility shutoff" },
      { id: "other_gov", label: "Medicare, student loans, a grant, or a debt collector" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        irs: ["irs_tax", "irs_ssa_tax_impersonation"],
        ssa: ["ssa_freeze"],
        jury: ["jury_duty_warrant"],
        embassy: ["chinese_embassy_customs"],
        utility: ["utility_shutoff", "utility_shutoff_urgency"],
        other_gov: [
          "student_loan_forgiveness",
          "student_loan_forgiveness_phish",
          "medicare_enrollment",
          "medicare_genetic_testing",
          "government_grant",
          "debt_collection_impersonation",
          "fake_law_firm_debt_threat",
        ],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Hard discriminator for this government impersonation" : null;
    },
  },
  {
    id: "sms_detail",
    prompt: "What was the text about?",
    kind: "choice",
    priority: 21,
    skipIf: (answers) => channelOf(answers) !== "sms" && themeOf(answers) !== "package",
    options: [
      { id: "package", label: "A package or delivery fee" },
      { id: "toll", label: "Unpaid highway tolls" },
      { id: "bank", label: "A bank fraud-alert link" },
      { id: "wrong_number", label: "A friendly “wrong number”" },
      { id: "task", label: "Easy online tasks" },
      { id: "otp", label: "They wanted a code that just arrived" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        package: ["package_delivery_sms", "parcel_customs_delivery_fee"],
        toll: ["unpaid_toll_sms", "toll_road_text_phish"],
        bank: ["bank_fraud_alert_sms"],
        wrong_number: ["wrong_number_romance", "wrong_number_text_rapport"],
        task: ["task_scam", "task_telegram_watch_to_earn"],
        otp: ["whatsapp_otp_hijack", "whatsapp_otp_code_share"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Matches that text-message pattern" : null;
    },
  },
  {
    id: "romance_detail",
    prompt: "In the romance story, which of these happened?",
    kind: "choice",
    priority: 22,
    skipIf: (answers) => answers.hook_who !== "romance" && themeOf(answers) !== "romance",
    options: [
      { id: "crypto_dash", label: "They pushed a crypto trading site with “profits”" },
      { id: "travel_money", label: "They asked for travel, medical, or visa money" },
      { id: "sextortion", label: "They threatened to leak intimate images" },
      { id: "recovery", label: "Someone offered to recover money I already lost" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        crypto_dash: ["romance_crypto", "pig_butchering_crypto_romance"],
        travel_money: ["dating_app_romance", "e_dating_money_request"],
        sextortion: ["sextortion_social", "sextortion_webcam_blackmail"],
        recovery: ["recovery_room", "crypto_recovery_secondary_scam"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits romance, pig-butchering, sextortion, and recovery-room" : null;
    },
  },
  {
    id: "job_detail",
    prompt: "In the job story, which fits?",
    kind: "choice",
    priority: 23,
    skipIf: (answers) => answers.hook_who !== "job" && themeOf(answers) !== "job",
    options: [
      { id: "equipment", label: "Pay for equipment or training" },
      { id: "mule", label: "Receive and forward money or packages" },
      { id: "tasks", label: "Tasks that later require my own deposits" },
      { id: "linkedin", label: "A recruiter for a well-known company" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        equipment: ["fake_job", "job_offer_training_equipment_fee"],
        mule: ["money_mule", "check_cashing_mule", "package_mule_reship_job"],
        tasks: ["task_scam", "task_telegram_watch_to_earn"],
        linkedin: ["linkedin_fake_recruiter", "linkedin_recruiter_crypto_job"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits fake jobs, mules, and task scams" : null;
    },
  },
  {
    id: "market_detail",
    prompt: "On the listing, which of these happened?",
    kind: "choice",
    priority: 24,
    skipIf: (answers) =>
      answers.hook_who !== "marketplace" &&
      themeOf(answers) !== "marketplace" &&
      answers.channel !== "marketplace",
    options: [
      { id: "rental", label: "Deposit before touring a rental" },
      { id: "overpay", label: "Buyer overpaid and asked me to refund the extra" },
      { id: "escrow", label: "A fake “escrow” or platform invoice" },
      { id: "off_platform", label: "Off-platform payment or a confirmation code" },
      { id: "pet", label: "Pet shipping fees sight-unseen" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        rental: ["rental_escrow", "rental_listing_deposit_scam"],
        overpay: ["marketplace_overpayment", "marketplace_overpayment_fake_check", "fake_check_overpayment", "cashier_check_overpayment"],
        escrow: ["facebook_marketplace_escrow", "facebook_marketplace_payment_scam"],
        off_platform: ["marketplace_confirmation_code", "payment_app_goods_scam", "paypal_friends_family_goods"],
        pet: ["pet_scam", "pet_sale_rehome_fee"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits rental, overpayment, escrow, and listing payment cons" : null;
    },
  },
  {
    id: "tech_detail",
    prompt: "How did the “tech support” contact start?",
    kind: "choice",
    priority: 25,
    skipIf: (answers) => answers.hook_who !== "company" && themeOf(answers) !== "account",
    options: [
      { id: "popup", label: "A pop-up virus warning" },
      { id: "search", label: "I searched a support number and called an ad" },
      { id: "refund", label: "They called about a refund or suspicious charge" },
      { id: "seed", label: "Wallet “support” asked for my seed phrase" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        popup: ["tech_support", "tech_support_remote_access", "youtube_tech_support_comment"],
        search: ["seo_poisoned_support", "google_ads_spoofed_support"],
        refund: ["amazon_apple_refund", "refund_scam_double_dip"],
        seed: ["seed_phrase_phishing", "crypto_seed_phrase_phish"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits pop-up, SEO, refund, and seed-phrase support" : null;
    },
  },
  {
    id: "crypto_detail",
    prompt: "Which crypto pitch was it?",
    kind: "choice",
    priority: 26,
    skipIf: (answers) =>
      answers.hook_who !== "prize" &&
      themeOf(answers) !== "investment" &&
      answers.demand !== "crypto",
    options: [
      { id: "trading", label: "Guaranteed high returns on a trading site" },
      { id: "celebrity", label: "A celebrity said send crypto to double it" },
      { id: "airdrop", label: "A free airdrop that wanted wallet approval" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        trading: ["crypto_investment", "investment_trading_app_clone", "romance_crypto", "pig_butchering_crypto_romance"],
        celebrity: ["celebrity_crypto_giveaway", "crypto_giveaway_elon_impersonation", "tiktok_fake_giveaway", "gift_card_tiktok_outreach", "lottery_prize"],
        airdrop: ["crypto_airdrop_drain", "wallet_drainer_dapp_approve"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits trading platforms, celebrity giveaways, and drainers" : null;
    },
  },
  {
    id: "account_detail",
    prompt: "Which account takeover fits?",
    kind: "choice",
    priority: 27,
    skipIf: (answers) => themeOf(answers) !== "account" && answers.ask_kind !== "access",
    options: [
      { id: "instagram", label: "Instagram verification, support, or a copyright strike" },
      { id: "discord", label: "Discord Nitro or QR login" },
      { id: "sim", label: "Sudden loss of cell service" },
      { id: "recovery", label: "“Help recover a hacked account”" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        instagram: ["instagram_verification_fee", "instagram_account_report_lure", "instagram_copyright_strike"],
        discord: ["discord_nitro_phishing", "discord_mod_nitro_phishing"],
        sim: ["sim_swap", "sim_swap_account_takeover"],
        recovery: ["account_recovery_social_engineer", "account_hack_spread_warning"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Splits Instagram, Discord, SIM-swap, and recovery cons" : null;
    },
  },
  {
    id: "phone_sales",
    prompt: "If this was a sales call, which pitch?",
    kind: "choice",
    priority: 28,
    skipIf: (answers) => {
      const channel = channelOf(answers);
      if (channel && channel !== "phone") return true;
      if (["romance", "job", "marketplace", "government", "family"].includes(answers.hook_who)) return true;
      if (["romance", "job", "marketplace", "package", "government", "family"].includes(themeOf(answers))) return true;
      return false;
    },
    options: [
      { id: "warranty", label: "Car warranty expiring" },
      { id: "sales", label: "Solar, insurance, timeshare, or a credit-rate cut" },
      { id: "hear_me", label: "They opened with “Can you hear me?”" },
      { id: "trial", label: "A free trial that turned into charges" },
      { id: "charity", label: "A charity after a disaster" },
    ],
    matches: (scam, value) =>
      exclusiveMethodMatch(scam, value, {
        warranty: ["car_warranty_robocall", "car_warranty_mail_robocall"],
        sales: ["solar_home_improvement", "timeshare_travel", "timeshare_exit_scam", "burial_insurance_robocall", "credit_rate_reduction"],
        hear_me: ["can_you_hear_me"],
        trial: ["free_trial_continuity"],
        charity: ["fake_charity_disaster", "charity_crisis_donation_scam"],
      }),
    reason(scam, value) {
      return this.matches(scam, value) ? "Matches that robocall / sales pitch" : null;
    },
  },
  {
    id: "impersonation",
    prompt: "Did they claim to be a bank, government agency, police, or a company you already use?",
    kind: "yesno",
    skipIf: (answers) => Boolean(answers.hook_who) && answers.hook_who !== "skip" && answers.hook_who !== "other",
    matches(scam, value) {
      const hit = impersonation(scam);
      return value === "yes" ? hit : !hit;
    },
    reason(scam, value) {
      if (value === "yes" && impersonation(scam)) {
        return "Impersonates a trusted institution";
      }
      return null;
    },
  },
  {
    id: "urgency",
    prompt: "Did they rush you, threaten arrest or a shutoff, or tell you to keep it secret?",
    kind: "yesno",
    matches(scam, value) {
      const hit = urgency(scam);
      return value === "yes" ? hit : !hit;
    },
    reason(scam, value) {
      if (value === "yes" && urgency(scam)) {
        return "Uses urgency, secrecy, or a threat";
      }
      return null;
    },
  },
  {
    id: "access",
    prompt: "Did they ask for a verification code, remote access, or to borrow your phone?",
    kind: "yesno",
    skipIf: (answers) => answers.ask_kind === "access",
    matches(scam, value) {
      const hit = remoteOrCode(scam);
      return value === "yes" ? hit : !hit;
    },
    reason(scam, value) {
      if (value === "yes" && remoteOrCode(scam)) {
        return "Goes after codes, logins, or device access";
      }
      return null;
    },
  },
  {
    id: "details",
    prompt: "Anything else we should know?",
    helper: "Names of apps, what they claimed, or a phrase they used.",
    kind: "text",
    matches: () => null,
  },
];

export const QUESTION_BY_ID = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question])
) as Record<string, Question>;
