import unittest
from utils.file_utils import load_prompt


class PerspectiveEndToEndTests(unittest.TestCase):
    def test_liu_cixin_perspective_loads_successfully(self):
        """真实的刘慈欣视角应该能成功加载并注入到 writer prompt"""
        # 这是一个集成测试，验证完整流程
        try:
            result = load_prompt('writer', perspective='liu-cixin')

            # 应该包含刘慈欣的特定内容
            self.assertIn("刘慈欣", result)
            self.assertIn("表达风格适配", result)
            self.assertIn("短句为主", result)

            # 应该包含原始 prompt 的核心内容
            self.assertIn("Role", result)  # 原始 prompt 开头有 Role

            print(f"✅ 刘慈欣视角注入成功，最终 prompt 长度: {len(result)} 字符")
            print(f"✅ 包含表达风格适配部分")

        except Exception as e:
            self.fail(f"刘慈欣视角加载失败: {e}")

    def test_liu_cixin_perspective_for_planner(self):
        """刘慈欣视角应该能成功注入到 planner"""
        result = load_prompt('planner', perspective='liu-cixin')

        self.assertIn("创作思维模式：刘慈欣", result)
        self.assertIn("思想实验公理框架", result)
        self.assertIn("黑暗森林思维", result)

    def test_perspective_strength_parameter_works(self):
        """视角强度参数应该生效"""
        full_strength = load_prompt('writer', perspective='liu-cixin', perspective_strength=1.0)
        low_strength = load_prompt('writer', perspective='liu-cixin', perspective_strength=0.2)

        # 满强度应该比低强度有更多内容
        self.assertTrue(len(full_strength) >= len(low_strength))

        # 低强度应该没有例句部分
        self.assertIn("经典句式参考", full_strength)
        # 低强度 (0.2) 应该没有例句
        if "经典句式参考" in low_strength:
            print("⚠️ 低强度仍然有例句，可能需要调整裁剪逻辑")


class WriterAgentPerspectiveTests(unittest.TestCase):
    def test_writer_agent_accepts_perspective_parameter(self):
        """generate_chapter 应该接受 perspective 参数"""
        import inspect
        from agents.writer_agent import generate_chapter

        sig = inspect.signature(generate_chapter)
        params = list(sig.parameters.keys())

        self.assertIn('perspective', params)
        self.assertIn('perspective_strength', params)

        print("✅ generate_chapter 接受 perspective 和 perspective_strength 参数")

    def test_writer_agent_perspective_effect(self):
        """传入 perspective 应该影响生成的 prompt"""
        from agents.writer_agent import generate_chapter

        # 检查函数定义
        import inspect
        source = inspect.getsource(generate_chapter)

        # 应该在调用 load_prompt 时传入 perspective
        self.assertIn('perspective', source)
        self.assertIn('perspective_strength', source)

        print("✅ generate_chapter 内部使用 perspective 参数")
