import unittest
from pathlib import Path
import tempfile
import yaml

from core.perspective_engine import PerspectiveEngine


class PerspectiveEngineLoadTests(unittest.TestCase):
    def test_can_instantiate_without_perspective(self):
        """不指定视角时也可以实例化"""
        engine = PerspectiveEngine()
        self.assertIsNone(engine.perspective_name)
        self.assertIsNone(engine.perspective_data)

    def test_raises_for_nonexistent_perspective(self):
        """加载不存在的视角时抛出 ValueError"""
        with self.assertRaises(ValueError) as ctx:
            PerspectiveEngine("nonexistent-writer-12345")
        self.assertIn("not found", str(ctx.exception).lower())
