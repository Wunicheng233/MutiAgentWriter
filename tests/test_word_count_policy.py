from backend.core.word_count_policy import WordCountPolicy, count_story_words


def _chapter_with_body(char: str, count: int) -> str:
    return f"第1章 标题\n\n{char * count}"


def test_default_policy_uses_balanced_85_to_120_percent_range():
    policy = WordCountPolicy()

    in_range = policy.evaluate(_chapter_with_body("字", 1700), target_word_count=2000)
    too_short = policy.evaluate(_chapter_with_body("字", 1699), target_word_count=2000)
    too_long = policy.evaluate(_chapter_with_body("字", 2401), target_word_count=2000)

    assert in_range.passed is True
    assert in_range.min_word_count == 1700
    assert in_range.max_word_count == 2400
    assert too_short.passed is False
    assert too_short.status == "under"
    assert too_long.passed is False
    assert too_long.status == "over"


def test_count_story_words_matches_chapter_body_chinese_count():
    content = "第9章 不计入标题\n\n第一段，有标点。\n\n第二段。"

    assert count_story_words(content) == 9


def test_policy_from_project_config_allows_hidden_override():
    policy = WordCountPolicy.from_config({
        "word_count_policy": {
            "min_ratio": 0.8,
            "max_ratio": 1.1,
        }
    })

    result = policy.evaluate(_chapter_with_body("字", 1600), target_word_count=2000)

    assert result.passed is True
    assert result.min_word_count == 1600
    assert result.max_word_count == 2200


def test_under_target_issue_is_actionable_expansion_repair():
    policy = WordCountPolicy()
    evaluation = policy.evaluate(_chapter_with_body("字", 1200), target_word_count=2000)

    issue = policy.build_issue(
        evaluation,
        budgeted_scene_plan={
            "beats": [
                {"beat_id": "beat-1", "goal": "开场承接上一章", "word_budget": 400},
                {"beat_id": "beat-2", "goal": "核心冲突升级", "word_budget": 900},
            ]
        },
    )

    assert issue["issue_type"] == "word_count_under_target"
    assert issue["fix_strategy"] == "expansion_repair"
    assert issue["severity"] == "high"
    assert "1200" in issue["fix_instruction"]
    assert "1700" in issue["fix_instruction"]
    assert "核心冲突升级" in issue["budgeted_scene_plan_summary"]


def test_over_target_issue_is_actionable_compression_repair():
    policy = WordCountPolicy()
    evaluation = policy.evaluate(_chapter_with_body("字", 2600), target_word_count=2000)

    issue = policy.build_issue(evaluation)

    assert issue["issue_type"] == "word_count_over_target"
    assert issue["fix_strategy"] == "compression_tension_rewrite"
    assert "2600" in issue["fix_instruction"]
    assert "2400" in issue["fix_instruction"]
