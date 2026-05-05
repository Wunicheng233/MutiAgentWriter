from backend.core.budgeted_scene_plan import (
    build_budgeted_scene_plan,
    format_budgeted_scene_plan_for_prompt,
)
from backend.core.word_count_policy import WordCountPolicy


def test_scene_anchors_become_budgeted_beats_that_sum_to_target():
    scene_anchors = [
        {
            "scene_id": "scene-1",
            "goal": "主角抵达废弃车站",
            "conflict": "跟踪者逼近",
            "character_intent": "确认上一章线索",
            "state_change": "发现站台编号异常",
            "hook_intent": "站牌显示不存在的列车",
        },
        {
            "scene_id": "scene-2",
            "goal": "主角进入候车室",
            "conflict": "广播念出主角姓名",
            "character_intent": "寻找出口",
            "state_change": "确认车站处于封闭状态",
            "hook_intent": "门后传来熟人的声音",
        },
    ]

    plan = build_budgeted_scene_plan(
        chapter_index=2,
        chapter_outline="本章目标：进入废弃车站",
        scene_anchors=scene_anchors,
        target_word_count=2000,
        policy=WordCountPolicy(),
    )

    assert plan["artifact_type"] == "budgeted_scene_plan"
    assert plan["chapter_index"] == 2
    assert plan["source"] == "scene_anchors"
    assert plan["target_word_count"] == 2000
    assert plan["min_word_count"] == 1700
    assert plan["max_word_count"] == 2400
    assert [beat["beat_id"] for beat in plan["beats"]] == ["scene-1", "scene-2"]
    assert sum(beat["word_budget"] for beat in plan["beats"]) == 2000

    prompt_text = format_budgeted_scene_plan_for_prompt(plan)
    assert "目标区间：1700-2400 字" in prompt_text
    assert "scene-2" in prompt_text
    assert "广播念出主角姓名" in prompt_text


def test_thin_outline_gets_default_opening_progress_conflict_hook_beats():
    plan = build_budgeted_scene_plan(
        chapter_index=1,
        chapter_outline="本章目标：主角收到一封来自未来的辞职信\n核心冲突：信上的日期是三天后\n结尾钩子：手机弹出倒计时",
        scene_anchors=[],
        target_word_count=1800,
        policy=WordCountPolicy(),
    )

    beat_labels = [beat["beat_id"] for beat in plan["beats"]]

    assert plan["source"] == "outline_fallback"
    assert beat_labels == ["opening", "progression", "conflict", "hook"]
    assert sum(beat["word_budget"] for beat in plan["beats"]) == 1800
    assert any("手机弹出倒计时" in item for beat in plan["beats"] for item in beat["must_include"])
