"""Tests for NovelState character memory extensions (Hermes-style)."""

import json
import tempfile
import unittest
from pathlib import Path
from backend.core.novel_state_service import (
    NovelStateService,
    DEFAULT_CHARACTER_PROFILE,
    DEFAULT_NOVEL_STATE,
    _ensure_character_profile,
)


class EnsureCharacterProfileTests(unittest.TestCase):
    """Tests for _ensure_character_profile helper."""

    def test_legacy_string_upgraded_to_dict(self):
        result = _ensure_character_profile("已受伤，在第5章左臂中箭")
        self.assertIsInstance(result, dict)
        self.assertEqual(result["state"], "已受伤，在第5章左臂中箭")
        self.assertIn("speech_pattern", result)
        self.assertIn("behavior_traits", result)
        self.assertIn("observations", result["speech_pattern"])
        self.assertIn("observations", result["behavior_traits"])

    def test_dict_format_keeps_existing_keys(self):
        profile = {
            "state": "健康",
            "speech_pattern": {"traits": ["短句"], "observations": [], "avoid": [], "confidence": 0.5},
            "behavior_traits": {"patterns": ["勇敢"], "observations": [], "confidence": 0.3},
        }
        result = _ensure_character_profile(profile)
        self.assertEqual(result["state"], "健康")
        self.assertEqual(result["speech_pattern"]["traits"], ["短句"])
        self.assertEqual(result["behavior_traits"]["patterns"], ["勇敢"])

    def test_dict_format_fills_missing_keys(self):
        result = _ensure_character_profile({"state": "test"})
        self.assertEqual(result["state"], "test")
        self.assertEqual(result["speech_pattern"]["observations"], [])
        self.assertEqual(result["behavior_traits"]["observations"], [])
        self.assertEqual(result["last_appearance"], 0)
        self.assertEqual(result["appearance_count"], 0)

    def test_empty_dict_uses_defaults(self):
        result = _ensure_character_profile({})
        self.assertEqual(result["state"], "")
        self.assertEqual(result["speech_pattern"]["traits"], [])
        self.assertEqual(result["behavior_traits"]["patterns"], [])


class NovelStateServiceCharacterMemoryTests(unittest.TestCase):
    """Tests for character memory methods on NovelStateService."""

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.service = NovelStateService(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    # record_character_observation
    # ------------------------------------------------------------------

    def test_record_speech_observation(self):
        result = self.service.record_character_observation(
            character_name="林舟",
            observation_type="speech",
            content="林舟说话简短，常用反问",
            chapter_index=1,
        )
        chars = result.get("characters", {})
        self.assertIn("林舟", chars)
        profile = chars["林舟"]
        self.assertEqual(len(profile["speech_pattern"]["observations"]), 1)
        self.assertEqual(profile["speech_pattern"]["observations"][0]["content"], "林舟说话简短，常用反问")
        self.assertEqual(profile["speech_pattern"]["observations"][0]["chapter"], 1)

    def test_record_behavior_observation(self):
        self.service.record_character_observation(
            character_name="林舟",
            observation_type="behavior",
            content="林舟行动先于言语",
            chapter_index=2,
        )
        state = self.service.load_state()
        profile = state["characters"]["林舟"]
        self.assertEqual(len(profile["behavior_traits"]["observations"]), 1)
        self.assertEqual(profile["behavior_traits"]["observations"][0]["content"], "林舟行动先于言语")

    def test_record_multiple_observations_accumulate(self):
        for i in range(3):
            self.service.record_character_observation("林舟", "speech", f"Observation {i}", chapter_index=i + 1)
        state = self.service.load_state()
        profile = state["characters"]["林舟"]
        self.assertEqual(len(profile["speech_pattern"]["observations"]), 3)

    def test_record_updates_last_appearance(self):
        self.service.record_character_observation("林舟", "speech", "obs1", chapter_index=1)
        self.service.record_character_observation("林舟", "speech", "obs2", chapter_index=5)
        state = self.service.load_state()
        self.assertEqual(state["characters"]["林舟"]["last_appearance"], 5)

    def test_record_increments_appearance_count(self):
        self.service.record_character_observation("林舟", "speech", "obs1", chapter_index=1)
        self.service.record_character_observation("林舟", "speech", "obs2", chapter_index=2)
        state = self.service.load_state()
        self.assertEqual(state["characters"]["林舟"]["appearance_count"], 2)

    def test_record_multiple_characters_independently(self):
        self.service.record_character_observation("林舟", "speech", "林舟说话短", chapter_index=1)
        self.service.record_character_observation("陈默", "speech", "陈默话多", chapter_index=1)
        state = self.service.load_state()
        self.assertIn("林舟", state["characters"])
        self.assertIn("陈默", state["characters"])
        self.assertEqual(len(state["characters"]), 2)

    # ------------------------------------------------------------------
    # build_character_profile
    # ------------------------------------------------------------------

    def test_build_character_profile_existing(self):
        self.service.record_character_observation("林舟", "speech", "短句", chapter_index=1)
        profile = self.service.build_character_profile("林舟")
        self.assertEqual(profile["speech_pattern"]["observations"][0]["content"], "短句")

    def test_build_character_profile_missing_returns_default(self):
        profile = self.service.build_character_profile("无名氏")
        self.assertEqual(profile, DEFAULT_CHARACTER_PROFILE)

    # ------------------------------------------------------------------
    # get_all_character_names
    # ------------------------------------------------------------------

    def test_get_all_character_names_empty(self):
        names = self.service.get_all_character_names()
        self.assertEqual(names, [])

    def test_get_all_character_names(self):
        self.service.record_character_observation("林舟", "speech", "obs", chapter_index=1)
        self.service.record_character_observation("陈默", "speech", "obs", chapter_index=1)
        names = self.service.get_all_character_names()
        self.assertIn("林舟", names)
        self.assertIn("陈默", names)

    # ------------------------------------------------------------------
    # has_sufficient_observations
    # ------------------------------------------------------------------

    def test_has_sufficient_observations_true(self):
        for i in range(3):
            self.service.record_character_observation("林舟", "speech", f"obs{i}", chapter_index=i + 1)
        self.assertTrue(self.service.has_sufficient_observations("林舟", min_count=3))

    def test_has_sufficient_observations_false(self):
        self.service.record_character_observation("林舟", "speech", "obs", chapter_index=1)
        self.assertFalse(self.service.has_sufficient_observations("林舟", min_count=3))

    def test_has_sufficient_observations_missing_character(self):
        self.assertFalse(self.service.has_sufficient_observations("不存在", min_count=1))

    def test_has_sufficient_observations_counts_both_types(self):
        self.service.record_character_observation("林舟", "speech", "speech1", chapter_index=1)
        self.service.record_character_observation("林舟", "behavior", "behav1", chapter_index=1)
        self.service.record_character_observation("林舟", "behavior", "behav2", chapter_index=2)
        self.assertTrue(self.service.has_sufficient_observations("林舟", min_count=3))


class NovelStateLegacyCompatibilityTests(unittest.TestCase):
    """Tests for backward compatibility with legacy novel_state format."""

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.service = NovelStateService(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_state_upgrades_legacy_characters(self):
        """Legacy string-format characters should be auto-upgraded on load."""
        state_path = self.temp_dir / "novel_state.json"
        legacy_data = {
            "schema_version": "novel_state_v1",
            "characters": {
                "林舟": "已受伤，在第5章左臂中箭",
                "陈默": "健康",
            },
            "timeline": [],
            "foreshadows": {},
            "style": {},
        }
        state_path.write_text(json.dumps(legacy_data, ensure_ascii=False), encoding="utf-8")

        state = self.service.load_state()
        self.assertIsInstance(state["characters"]["林舟"], dict)
        self.assertEqual(state["characters"]["林舟"]["state"], "已受伤，在第5章左臂中箭")
        self.assertIn("speech_pattern", state["characters"]["林舟"])
        self.assertIsInstance(state["characters"]["陈默"], dict)
        self.assertEqual(state["characters"]["陈默"]["state"], "健康")

    def test_load_state_preserves_v2_characters(self):
        """V2 dict-format characters should be preserved as-is."""
        state_path = self.temp_dir / "novel_state.json"
        v2_data = {
            "schema_version": "novel_state_v2",
            "characters": {
                "林舟": {
                    "state": "健康",
                    "speech_pattern": {"traits": ["短句"], "avoid": [], "confidence": 0.7, "observations": []},
                    "behavior_traits": {"patterns": [], "confidence": 0.0, "observations": []},
                    "last_appearance": 5,
                    "appearance_count": 3,
                }
            },
            "timeline": [],
            "foreshadows": {},
            "style": {},
        }
        state_path.write_text(json.dumps(v2_data, ensure_ascii=False), encoding="utf-8")

        state = self.service.load_state()
        profile = state["characters"]["林舟"]
        self.assertEqual(profile["state"], "健康")
        self.assertEqual(profile["speech_pattern"]["traits"], ["短句"])
        self.assertEqual(profile["last_appearance"], 5)

    def test_save_state_sets_v2_schema(self):
        self.service.record_character_observation("林舟", "speech", "短句", chapter_index=1)
        state_path = self.temp_dir / "novel_state.json"
        saved = json.loads(state_path.read_text(encoding="utf-8"))
        self.assertEqual(saved["schema_version"], "novel_state_v2")
        self.assertIn("updated_at", saved)


class NovelStateFormatCharactersTests(unittest.TestCase):
    """Tests for _format_characters with v2 profiles."""

    def test_format_characters_empty(self):
        result = NovelStateService._format_characters({})
        self.assertIn("暂无新增动态状态", result)

    def test_format_characters_with_traits(self):
        chars = {
            "林舟": {
                "state": "受伤",
                "speech_pattern": {"traits": ["短句", "少解释"], "avoid": [], "confidence": 0.0, "observations": []},
                "behavior_traits": {"patterns": [], "confidence": 0.0, "observations": []},
                "last_appearance": 3,
                "appearance_count": 1,
            }
        }
        result = NovelStateService._format_characters(chars)
        self.assertIn("林舟", result)
        self.assertIn("受伤", result)
        self.assertIn("短句", result)
        self.assertIn("少解释", result)

    def test_format_characters_with_string_fallback(self):
        """Should handle legacy string format gracefully."""
        chars = {"林舟": "已受伤"}
        result = NovelStateService._format_characters(chars)
        self.assertIn("林舟", result)
        self.assertIn("已受伤", result)


if __name__ == "__main__":
    unittest.main()
