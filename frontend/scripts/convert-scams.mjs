/**
 * Converts the pattern TSV plus the method catalog into the JSON the site
 * scores against. Catalog ids that already exist as slugs are merged
 * instead of duplicated.
 *
 * Usage: node scripts/convert-scams.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsvPath = join(root, "data", "reddit_scam_patterns.062126_091926.tsv");
const catalogPath = join(root, "data", "scam-catalog.json");
const outPath = join(root, "src", "data", "scams.json");

const TITLE_OVERRIDES = {
  irs_ssa_tax_impersonation: "IRS / SSA tax impersonation",
  bank_amex_fbi_spoof_call: "Bank / Amex / FBI spoof call",
  otp_google_wallet_checkout_phish: "OTP / Google Wallet checkout phish",
  sim_swap_account_takeover: "SIM-swap account takeover",
  ceo_business_email_compromise: "CEO / business email compromise",
  mfa_otp_unused_account_texts: "Unexpected MFA / OTP texts",
  pig_butchering_crypto_romance: "Pig-butchering crypto romance",
  zelle_venmo_wrong_person_refund: "Zelle / Venmo wrong-person refund",
  paypal_friends_family_goods: "PayPal Friends & Family goods scam",
  tech_support_remote_access: "Tech-support remote access",
  no_caller_id_late_night_probe: "No-caller-ID late-night probe",
  facetime_verify_identity_bridge: "FaceTime \u201cverify identity\u201d bridge",
  qr_code_payment_redirect: "QR-code payment redirect",
  atm_card_skimmer_physical: "Physical ATM / pump skimmer",
  e_dating_money_request: "E-dating money request",
  cashier_check_overpayment: "Cashier\u2019s-check overpayment",
  marketplace_overpayment_fake_check: "Marketplace fake-check overpayment",
};
