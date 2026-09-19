from intel import PatternIndex, retrieve
from grok import run_grok_flags
from schemas import GrokFlags


SAMPLE_ROWS = [
    {
        "id": "facebook_marketplace_payment_scam",
        "name": "facebook_marketplace_payment_scam",
        "title": "Facebook Marketplace Payment Scam",
        "description": "Buyer overpays on Facebook Marketplace then asks to refund extra via Zelle or gift cards.",
        "platforms": ["facebook"],
        "demands": ["zelle", "gift_cards"],
        "victim_roles": ["seller"],
        "frequency": 121,
    },
    {
        "id": "elder_romance_whatsapp_owed_money",
        "name": "elder_romance_whatsapp_owed_money",
        "title": "Elder Romance Whatsapp Owed Money",
        "description": "Romance partner on WhatsApp claims they are overseas and need money wired for travel or customs.",
        "platforms": ["whatsapp"],
        "demands": ["wire"],
        "victim_roles": ["elder"],
        "frequency": 92,
    },
    {
        "id": "job_offer_training_equipment_fee",
        "name": "job_offer_training_equipment_fee",
        "title": "Job Offer Training Equipment Fee",
        "description": "Fake remote job requires a training fee or laptop payment before the first paycheck.",
        "platforms": ["email"],
        "demands": ["wire"],
        "victim_roles": ["job_seeker"],
        "frequency": 79,
    },
]


def test_semantic_search_ranks_marketplace() -> None:
    index = PatternIndex(SAMPLE_ROWS)
    hits = index.search("overpaid on marketplace wants zelle refund", limit=3)
    assert hits
    assert hits[0]["name"] == "facebook_marketplace_payment_scam"


def test_empty_query_lists_by_frequency() -> None:
    index = PatternIndex(SAMPLE_ROWS)
    hits = index.search("", limit=10)
    assert [row["name"] for row in hits] == [
        "facebook_marketplace_payment_scam",
        "elder_romance_whatsapp_owed_money",
        "job_offer_training_equipment_fee",
    ]


def test_retrieve_uses_cached_index(monkeypatch) -> None:
    monkeypatch.setattr("intel.get_index", lambda: PatternIndex(SAMPLE_ROWS))
    hits = retrieve("whatsapp romance customs money", k=2)
    assert hits[0]["name"] == "elder_romance_whatsapp_owed_money"


def test_run_grok_flags_passes_rag_patterns(monkeypatch) -> None:
    from paths import ensure_import_paths

    ensure_import_paths()
    import detect_scam as detect_mod

    captured: dict = {}
    index = PatternIndex(SAMPLE_ROWS)
    monkeypatch.setattr("intel.retrieve", lambda text, k=5: index.search(text, limit=k))

    def fake_detect(transcript, api_key=None, rag_patterns=None):
        captured["rag"] = rag_patterns
        captured["transcript"] = transcript
        return {
            "is_scam": True,
            "scam_type": "facebook_marketplace_payment_scam",
            "confidence": 0.9,
            "reasoning": "Overpay refund.",
            "method": "zelle refund",
            "target": "seller",
        }

    monkeypatch.setattr(detect_mod, "detect_scam", fake_detect)

    flags = run_grok_flags("They overpaid on Facebook Marketplace and want a Zelle refund.")
    assert isinstance(flags, GrokFlags)
    assert flags.scam_type == "facebook_marketplace_payment_scam"
    assert captured["rag"]
    assert captured["rag"][0]["name"] == "facebook_marketplace_payment_scam"
