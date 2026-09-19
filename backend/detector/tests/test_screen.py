from keywords import select_hits
from screen import compute_alarm, map_ai_generated


def test_map_ai_generated() -> None:
    assert map_ai_generated("yes") is True
    assert map_ai_generated("no") is False
    assert map_ai_generated("unknown") is None
    assert map_ai_generated(None) is None


def test_select_hits_filters_and_thresholds() -> None:
    scores = {"gift_card": 0.9, "alexa": 0.99, "bail": 0.4}
    hits = select_hits(scores, threshold=0.5, target_labels={"gift_card", "bail"})
    assert [h.label for h in hits] == ["gift_card"]


def test_select_hits_all_labels_when_unfiltered() -> None:
    scores = {"gift_card": 0.9, "bail": 0.8}
    hits = select_hits(scores, threshold=0.5, target_labels=set())
    assert [h.label for h in hits] == ["gift_card", "bail"]


def test_alarm_not_sensitive_when_cold() -> None:
    alarm, sensitivity, escalate = compute_alarm(
        ai_score=0.2,
        keyword_hit_count=0,
        ai_escalate_at=0.5,
        min_keyword_hits=1,
    )
    assert escalate is False
    assert sensitivity == "not_sensitive"
    assert alarm == 0.2


def test_alarm_escalates_on_ai_alone() -> None:
    alarm, sensitivity, escalate = compute_alarm(
        ai_score=0.6,
        keyword_hit_count=0,
        ai_escalate_at=0.5,
        min_keyword_hits=1,
    )
    assert escalate is True
    assert sensitivity == "medium"
    assert alarm == 0.6


def test_alarm_escalates_on_keyword_alone() -> None:
    alarm, sensitivity, escalate = compute_alarm(
        ai_score=None,
        keyword_hit_count=1,
        ai_escalate_at=0.5,
        min_keyword_hits=1,
    )
    assert escalate is True
    assert sensitivity == "low"
    assert alarm == 1.0


def test_alarm_high_when_ai_and_keyword() -> None:
    alarm, sensitivity, escalate = compute_alarm(
        ai_score=0.9,
        keyword_hit_count=1,
        ai_escalate_at=0.5,
        min_keyword_hits=1,
    )
    assert escalate is True
    assert sensitivity == "high"
    assert alarm == 1.0
