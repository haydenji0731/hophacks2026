# Keyword reference

Seeded from the We Hate Scammers catalog in [haydenji0731/hophacks2026](https://github.com/haydenji0731/hophacks2026) — not a full-site scraper list.

| Source | What we took |
| --- | --- |
| `backend/detector/keywords.py` `SCAM_WAKE_PHRASES` | gift card, Google Play, Social Security, IRS, arrest warrant, don't tell, wire transfer, verification code, your grandson, bail |
| `training_data/detect_scam.py` classifier prompt | urgency, gift cards / wire / crypto, impersonation, secrecy, lottery/prize, SSN / OTP |
| `training_data` labeled transcripts | family bail + Western Union, warrant + bond, utility shutoff + Bitcoin, bank fraud-desk + codes |
| `training_data/hard_tp_voicemails.jsonl` | gift-card shutoff, OTP steal, import-fee SSN, prepaid clinic fee, election prepaid + SSN |
| `frontend/src/data/questions.js` `SCAM_TYPES` | `grandparent_bail`, `government_impersonation`, `tech_support`, `bank_utility`, `prize_refund`, `phishing_link` |
| `backend/db/seeds` top Reddit patterns | romance owed-money, job equipment fee, marketplace off-platform pay |

Weak words (`urgent`, `gift`, `support`, `prize`, `refund`) stay at weight 1. A matched multi-word phrase consumes its tokens so “gift card” does not also charge `gift`.

`scamIds` on each rule deep-link the questionnaire as `?hint={topScamId}`.
