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


class PerspectiveFileLoadTests(unittest.TestCase):
    def setUp(self):
        # Create temporary test directory
        self.temp_dir = tempfile.mkdtemp()
        self.original_builtin = PerspectiveEngine.BUILTIN_PERSPECTIVES
        PerspectiveEngine.BUILTIN_PERSPECTIVES = Path(self.temp_dir)

    def tearDown(self):
        PerspectiveEngine.BUILTIN_PERSPECTIVES = self.original_builtin
        import shutil
        shutil.rmtree(self.temp_dir)

    def test_loads_complete_perspective_structure(self):
        """完整的视角文件应该能被正确解析"""
        # 创建测试视角文件
        test_perspective = {
            'name': '测试作家',
            'genre': '测试题材',
            'description': '测试描述',
            'strength_recommended': 0.7,
            'strengths': ['优点1', '优点2'],
            'weaknesses': ['缺点1'],
            'planner_injection': {
                'mental_models': '心智模型测试',
                'worldview_principles': '世界观原则测试',
            },
            'writer_injection': {
                'sentence_patterns': '句式测试',
                'vocabulary_traits': '词汇测试',
                'rhythm_principles': '节奏测试',
                'example_sentences': '例句测试',
            },
            'critic_injection': '评审标准测试',
            'revise_injection': '修改策略测试',
        }

        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump(test_perspective, f, allow_unicode=True)

        engine = PerspectiveEngine('test-writer')

        self.assertEqual(engine.perspective_data['name'], '测试作家')
        self.assertEqual(engine.perspective_data['planner_injection']['mental_models'], '心智模型测试')
        self.assertEqual(engine.perspective_data['writer_injection']['sentence_patterns'], '句式测试')

    def test_list_available_perspectives(self):
        """list_available_perspectives 应该返回所有可用视角"""
        # 创建测试视角
        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump({
                'name': '测试作家',
                'genre': '测试题材',
                'description': '测试描述',
                'strength_recommended': 0.7,
                'strengths': [],
                'weaknesses': [],
                'planner_injection': {},
                'writer_injection': {},
                'critic_injection': '',
                'revise_injection': '',
            }, f, allow_unicode=True)

        perspectives = PerspectiveEngine.list_available_perspectives()

        self.assertEqual(len(perspectives), 1)
        self.assertEqual(perspectives[0]['id'], 'test-writer')
        self.assertEqual(perspectives[0]['name'], '测试作家')
        self.assertTrue(perspectives[0]['builtin'])
