export const QUESTIONS = [
  {
    id: "channel",
    prompt: "How did they reach you?",
    help: "If you are not sure, pick the closest one.",
    options: [
      { value: "phone", label: "Phone call or voicemail" },
      { value: "text", label: "Text message" },
      { value: "email", label: "Email" },
      { value: "social", label: "Social media or chat app" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    id: "impersonation",
    prompt: "Did they claim to be someone you should trust?",
    help: "Bank, IRS, police, a company, or a family member.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "I am not sure" },
    ],
  },
  {
    id: "who",
    prompt: "Who did they say they were?",
    help: "Skip if they did not name anyone.",
    optional: true,
    options: [
      { value: "government", label: "Government (IRS, Social Security, police)" },
      { value: "bank", label: "Bank, card company, or utility" },
      { value: "tech", label: "Tech support (Microsoft, Apple, Amazon)" },
      { value: "family", label: "A family member or friend in trouble" },
      { value: "prize", label: "A prize, refund, or job offer" },
      { value: "other", label: "Someone else / they did not say" },
    ],
  },
  {
    id: "money",
    prompt: "Did they ask you to send money or pay something?",
    options: [
      { value: "gift_card", label: "Gift cards" },
      { value: "wire", label: "Wire transfer or cash" },
      { value: "crypto", label: "Crypto or Bitcoin" },
      { value: "link", label: "Click a link or share a code" },
      { value: "no", label: "They did not ask for money" },
    ],
  },
  {
    id: "urgency",
    prompt: "Did they rush you or tell you to keep it secret?",
    options: [
      { value: "yes", label: "Yes — act now or don't tell anyone" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "ai_voice",
    prompt: "If it was a call, did the voice sound odd or like a recording?",
    help: "AI voices can sound almost like a real person, including family.",
    options: [
      { value: "yes", label: "Yes, it sounded fake or off" },
      { value: "no", label: "It sounded like a real person" },
      { value: "unsure", label: "I am not sure / it was not a call" },
    ],
  },
];

export const SCAM_TYPES = [
  {
    id: "grandparent_bail",
    name: "Family emergency / bail scam",
    summary:
      "Someone pretends a loved one is in trouble and needs gift cards or cash right away — often by phone, sometimes with an AI voice.",
    scores: { channel: { phone: 2, text: 1 }, who: { family: 4 }, money: { gift_card: 3, wire: 2 }, urgency: { yes: 2 }, ai_voice: { yes: 2 } },
  },
  {
    id: "government_impersonation",
    name: "Government impersonation (IRS, SSA, police)",
    summary:
      "A caller claims to be the IRS, Social Security, or police and threatens arrest or a frozen account unless you pay.",
    scores: { channel: { phone: 2 }, who: { government: 4 }, money: { gift_card: 2, wire: 2 }, urgency: { yes: 2 } },
  },
  {
    id: "tech_support",
    name: "Tech support scam",
    summary:
      "They say your computer is hacked and want remote access, gift cards, or a payment to 'fix' it.",
    scores: { channel: { phone: 2 }, who: { tech: 4 }, money: { gift_card: 2, link: 2 }, urgency: { yes: 1 } },
  },
  {
    id: "bank_utility",
    name: "Bank or utility impersonation",
    summary:
      "They claim your account will be closed or your power shut off unless you pay or read a code from a text.",
    scores: { channel: { phone: 2, text: 1 }, who: { bank: 4 }, money: { gift_card: 1, wire: 2, link: 2 }, urgency: { yes: 2 } },
  },
  {
    id: "prize_refund",
    name: "Fake prize, refund, or job offer",
    summary:
      "Too-good-to-be-true money, a refund, or a job — then they ask you to pay fees or share personal info.",
    scores: { who: { prize: 4 }, money: { gift_card: 2, crypto: 2, link: 2 }, urgency: { yes: 1 } },
  },
  {
    id: "phishing_link",
    name: "Phishing link or one-time code steal",
    summary:
      "A text or email pushes a link or asks you to read a verification code. Real companies do not ask for that on a cold call.",
    scores: { channel: { text: 3, email: 3 }, money: { link: 4 } },
  },
];

// Warning signs that count toward the "likely / unlikely" verdict.
// Each rule adds `weight` points when it matches. Score >= LIKELY_AT => likely a scam.
const LIKELY_AT = 3;

// Highest possible raw score from FLAG_RULES below (money 3 + urgency 2 +
// impersonation 1 + ai_voice 1). Used to rescale riskScore onto a /10 display.
const MAX_RISK_SCORE = 7;

const FLAG_RULES = [
  {
    weight: 3,
    test: (a) => a.money === "gift_card",
    text: "They asked you to pay with gift cards. Real companies and agencies never do this.",
  },
  {
    weight: 3,
    test: (a) => a.money === "wire",
    text: "They asked for a wire transfer or cash, which is hard to trace or get back.",
  },
  {
    weight: 3,
    test: (a) => a.money === "crypto",
    text: "They asked you to pay with crypto or Bitcoin. Real organizations do not ask for this.",
  },
  {
    weight: 3,
    test: (a) => a.money === "link",
    text: "They asked you to click a link or share a code, a common way scammers steal accounts.",
  },
  {
    weight: 2,
    test: (a) => a.urgency === "yes",
    text: "They rushed you or told you to keep it secret. Scammers use pressure so you cannot think or check.",
  },
  {
    weight: 1,
    test: (a) => a.impersonation === "yes",
    text: "They claimed to be someone you would trust, such as a bank, agency, or family member.",
  },
  {
    weight: 1,
    test: (a) => a.ai_voice === "yes",
    text: "The voice sounded fake or off. Scammers can now copy real voices with AI.",
  },
];

// Specific guidance per payment/ask type, so the headline matches what the
// user actually described instead of a generic "do not send money" line.
const MONEY_GUIDANCE = {
  gift_card: "Do not buy gift cards for them.",
  wire: "Do not wire money or send cash.",
  crypto: "Do not send crypto or Bitcoin.",
  link: "Do not click the link or share the code.",
};

export function headline(result) {
  if (!result.likely) return "This does not look typical.";
  const moneyLine = MONEY_GUIDANCE[result.answers?.money];
  if (moneyLine) return moneyLine;
  if (result.primary) return `This matches a ${result.primary.name.toLowerCase()}.`;
  return "Do not send money or codes.";
}

export function lede(result) {
  if (!result.likely) {
    return "Based on your answers this does not look like a typical scam. That is a guide, not a guarantee. If it still feels wrong, hang up and verify independently.";
  }
  const scamName = result.primary?.name;
  if (scamName) {
    return `What you described matches a ${scamName.toLowerCase()}. Hang up and call the real organization or person on a number you already trust — not one they gave you.`;
  }
  return "Several things you described match common warning signs. Hang up and call the real organization on a number you already trust.";
}

export function diagnose(answers) {
  const safe = answers || {};
  const filled = QUESTIONS.filter((q) => Boolean(safe[q.id])).length;
  const hasDetails = Boolean(String(safe.details || "").trim());
  const answeredCount = filled + (hasDetails ? 1 : 0);

  // 1) Verdict: how many warning signs did they describe?
  const matched = FLAG_RULES.filter((rule) => rule.test(safe));
  const riskScore = matched.reduce((sum, rule) => sum + rule.weight, 0);
  const flags = matched.map((rule) => rule.text);

  // Rescale the raw 0-7 score onto a friendlier /10 display.
  const riskScore10 = Math.round((riskScore / MAX_RISK_SCORE) * 10);

  let verdict;
  if (filled < 3) verdict = "unsure";
  else if (riskScore >= LIKELY_AT) verdict = "likely";
  else verdict = "unlikely";

  // 2) Which known scam type does it look most like? (only shown for "likely")
  const ranked = SCAM_TYPES.map((scam) => {
    let score = 0;
    for (const [qid, mapping] of Object.entries(scam.scores)) {
      const chosen = safe[qid];
      if (chosen && mapping[chosen]) score += mapping[chosen];
    }
    if (hasDetails) score += 0.5;
    return { ...scam, score };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const hasMatch = verdict === "likely" && Boolean(top) && top.score >= 3;

  return {
    verdict, // "likely" | "unlikely" | "unsure"
    likely: verdict === "likely",
    unlikely: verdict === "unlikely",
    insufficient: verdict === "unsure",
    riskScore: riskScore10,
    flags,
    answeredCount,
    primary: hasMatch ? top : null,
    alternatives: hasMatch ? ranked.slice(1, 4).filter((s) => s.score > 0) : [],
    answers: safe,
  };
}

const PLATFORM = {
  phone: "phone",
  text: "sms",
  email: "web",
  social: "discord",
  other: "other",
};

const METHOD = {
  gift_card: "gift card payment request",
  wire: "wire transfer request",
  crypto: "crypto payment request",
  link: "phishing link or code request",
  no: "none",
};

const TARGET = {
  government: "general consumer",
  bank: "account holder",
  tech: "computer user",
  family: "family member / older adult",
  prize: "general consumer",
  other: "unclear",
};

function optionLabel(questionId, value) {
  const question = QUESTIONS.find((q) => q.id === questionId);
  const opt = question?.options.find((o) => o.value === value);
  return opt?.label || value;
}

export function reportPayload(result) {
  const answers = result.answers || {};
  const lines = QUESTIONS.filter((q) => answers[q.id]).map(
    (q) => `${q.prompt} ${optionLabel(q.id, answers[q.id])}.`,
  );
  const details = String(answers.details || "").trim();
  if (details) lines.push(`Other details: ${details}`);

  const ai = answers.ai_voice;
  return {
    scam_type: result.primary.name,
    method: METHOD[answers.money] || "none",
    target: TARGET[answers.who] || "unclear",
    reasoning: lines.join(" "),
    ai_generated: ai === "yes" ? true : ai === "no" ? false : null,
    platform: PLATFORM[answers.channel] || "other",
  };
}
