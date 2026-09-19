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

export function diagnose(answers) {
  const filled = QUESTIONS.filter((q) => Boolean(answers?.[q.id])).length;
  const hasDetails = Boolean(String(answers?.details || "").trim());
  const answeredCount = filled + (hasDetails ? 1 : 0);

  const ranked = SCAM_TYPES.map((scam) => {
    let score = 0;
    for (const [qid, mapping] of Object.entries(scam.scores)) {
      const chosen = answers[qid];
      if (chosen && mapping[chosen]) score += mapping[chosen];
    }
    if (hasDetails) score += 0.5;
    return { ...scam, score };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const likely = Boolean(top) && top.score >= 3 && filled >= 2;
  const insufficient = !likely;
  return {
    likely,
    insufficient,
    answeredCount,
    primary: likely ? top : null,
    alternatives: likely ? ranked.slice(1, 4).filter((s) => s.score > 0) : [],
    answers,
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
