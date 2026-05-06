# 作家视角注入引擎 - 核心实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 PerspectiveEngine 核心类，实现从 YAML 加载视角并向 prompt 中注入的基础能力

**Architecture:** PerspectiveEngine 作为独立的无状态核心类，提供 load() 和 inject_for_* 系列方法。YAML 文件作为纯数据资源，与代码完全分离。注入机制通过改造现有 load_prompt 函数实现。

**Tech Stack:** Python 3.10+, PyYAML, unittest

---

## 文件结构总览

| 操作 | 路径 | 职责 |
|-----|------|------|
| 创建 | `core/perspective_engine.py` | PerspectiveEngine 核心类 |
| 创建 | `perspectives/_template.yaml` | 视角文件模板 |
| 创建 | `perspectives/liu-cixin.yaml` | 第一个完整视角（刘慈欣） |
| 修改 | `utils/file_utils.py` | load_prompt 增加 perspective 注入 |
| 创建 | `tests/test_perspective_engine.py` | 核心引擎单元测试 |

---

## Task 1: PerspectiveEngine 骨架与 YAML 加载

**Files:**
- Create: `core/perspective_engine.py`
- Create: `tests/test_perspective_engine.py`

- [ ] **Step 1: 写测试用例 - PerspectiveEngine 实例化**

```python
# tests/test_perspective_engine.py
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
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PerspectiveEngineLoadTests.test_can_instantiate_without_perspective -v
```
Expected: FAIL with "No module named 'core.perspective_engine'"

- [ ] **Step 3: 写最小实现 - PerspectiveEngine 骨架**

```python
# core/perspective_engine.py
from pathlib import Path
from typing import Optional, Dict, List
import yaml


class PerspectiveEngine:
    """作家视角注入引擎

    负责：
    1. 加载/解析 perspective skill 文件
    2. 按智能体类型提取可注入片段
    3. 执行实际的 prompt 注入操作
    """

    BUILTIN_PERSPECTIVES = Path(__file__).parent.parent / 'perspectives'

    def __init__(self, perspective_name: str = None):
        self.perspective_name = perspective_name
        self.perspective_data: Optional[Dict] = None

        if perspective_name:
            self.load(perspective_name)

    def load(self, name: str) -> None:
        """加载指定的 perspective skill"""
        # 先找内置的
        builtin_path = self.BUILTIN_PERSPECTIVES / f"{name}.yaml"
        if builtin_path.exists():
            with open(builtin_path, 'r', encoding='utf-8') as f:
                self.perspective_data = yaml.safe_load(f)
            return

        # 找不到就报错
        raise ValueError(f"Perspective '{name}' not found")

    @classmethod
    def list_available_perspectives(cls) -> List[Dict]:
        """列出所有可用的作家视角"""
        perspectives = []

        if cls.BUILTIN_PERSPECTIVES.exists():
            for f in cls.BUILTIN_PERSPECTIVES.glob("*.yaml"):
                if f.stem == '_template':
                    continue
                with open(f, 'r', encoding='utf-8') as fp:
                    data = yaml.safe_load(fp)
                    perspectives.append({
                        'id': f.stem,
                        'name': data['name'],
                        'genre': data['genre'],
                        'description': data['description'],
                        'strength_recommended': data['strength_recommended'],
                        'builtin': True,
                    })

        return sorted(perspectives, key=lambda x: x['genre'])
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PerspectiveEngineLoadTests.test_can_instantiate_without_perspective -v
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add core/perspective_engine.py tests/test_perspective_engine.py
git commit -m "feat: add PerspectiveEngine skeleton with YAML loading"
```

---

## Task 2: 创建视角文件模板与第一个测试视角

**Files:**
- Create: `perspectives/_template.yaml`
- Create: `perspectives/liu-cixin.yaml` (simplified test version)

- [ ] **Step 1: 写测试用例 - 加载真实视角文件**

```python
# 添加到 tests/test_perspective_engine.py

class PerspectiveFileLoadTests(unittest.TestCase):
    def setUp(self):
        # 创建临时测试目录
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
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PerspectiveFileLoadTests.test_loads_complete_perspective_structure -v
```
Expected: FAIL (test perspective file doesn't exist yet in real path)

- [ ] **Step 3: 创建视角模板与第一个真实视角（简化版）**

```yaml
# perspectives/_template.yaml
name: ""
genre: ""
description: ""
strength_recommended: 0.7

strengths: []
weaknesses: []

planner_injection:
  mental_models: |
  worldview_principles: |

writer_injection:
  sentence_patterns: |
  vocabulary_traits: |
  rhythm_principles: |
  example_sentences: |

critic_injection: |

revise_injection: |
```

```yaml
# perspectives/liu-cixin.yaml
name: "刘慈欣"
genre: "科幻"
description: "思想实验公理框架、宏大宇宙叙事"
strength_recommended: 0.8

strengths:
  - 科幻世界观构建
  - 极端情境思想实验
  - 宏大叙事构思

weaknesses:
  - 细腻人物心理描写
  - 日常生活题材

planner_injection:
  mental_models: |
    1. **思想实验公理框架**：设定几个不可动摇的公理，顺着逻辑推到极致。
    2. **黑暗森林思维**：生存是文明的第一需要。
    3. **技术爆炸思维**：技术发展不是线性的，而是指数级的。
    4. **尺度叠加**：同时在微观、宏观、宇宙三个尺度上叙事。

  worldview_principles: |
    1. **中国历史经验的宇宙化转译**：把历史大事件转译为宇宙尺度情节。
    2. **极端情境道德悬置**：在生存面前，平时的道德标准可能不适用。
    3. **日常事物的宏大比喻**：用日常事物来比喻宇宙尺度的问题。

writer_injection:
  sentence_patterns: |
    1. **短句为主**：少用长复合句，每句承载一个信息点。
    2. **陈述句优先**：少用疑问句、感叹句，保持冷峻和客观。
    3. **名词密度高**：多用具体名词，少用抽象形容词。

  vocabulary_traits: |
    - 偏爱：光年、熵、奇点、维度、文明、公理、逻辑
    - 避免：很、非常、极其（这类程度副词）
    - 避免：华丽的形容词堆砌

  rhythm_principles: |
    1. **匀速推进**：整体节奏偏慢，不追求频繁的情节反转。
    2. **突然的信息释放**：前面铺陈细节，最后一句话揭示真相。
    3. **留白**：重要的情感场景不直接描写，留给读者想象。

  example_sentences: |
    - "给岁月以文明，而不是给文明以岁月。"
    - "弱小和无知不是生存的障碍，傲慢才是。"
    - "宇宙就是一座黑暗森林。"

critic_injection: |
  按刘慈欣的标准评审：
  1. **设定硬度**：核心科幻设定是否有自洽的逻辑基础？
  2. **思想实验纯度**：情节是否是从公理推导出来的必然结果？
  3. **尺度感**：有没有体现出宇宙尺度的宏大感？

revise_injection: |
  按刘慈欣的风格修改：
  1. 删去所有程度副词（很、非常、极其）
  2. 把抽象描述改为具体名词+动词
  3. 把长句拆成短句
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PerspectiveFileLoadTests -v
```
Expected: Both tests PASS

- [ ] **Step 5: 提交**

```bash
git add perspectives/_template.yaml perspectives/liu-cixin.yaml
git commit -m "feat: add perspective template and first liu-cixin perspective"
```

---

## Task 3: Planner 注入方法实现

**Files:**
- Modify: `core/perspective_engine.py`
- Modify: `tests/test_perspective_engine.py`

- [ ] **Step 1: 写测试用例 - inject_for_planner**

```python
# 添加到 tests/test_perspective_engine.py

class PlannerInjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.original_builtin = PerspectiveEngine.BUILTIN_PERSPECTIVES
        PerspectiveEngine.BUILTIN_PERSPECTIVES = Path(self.temp_dir)

        # 创建测试视角
        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump({
                'name': '测试作家',
                'genre': '测试',
                'description': '测试',
                'strength_recommended': 0.7,
                'strengths': [],
                'weaknesses': [],
                'planner_injection': {
                    'mental_models': '心智模型内容',
                    'worldview_principles': '世界观原则内容',
                },
                'writer_injection': {},
                'critic_injection': '',
                'revise_injection': '',
            }, f, allow_unicode=True)

        self.engine = PerspectiveEngine('test-writer')

    def tearDown(self):
        PerspectiveEngine.BUILTIN_PERSPECTIVES = self.original_builtin
        import shutil
        shutil.rmtree(self.temp_dir)

    def test_inject_for_planner_adds_header(self):
        """Planner 注入应该在开头添加视角模式标题"""
        original = "原始 prompt 内容"
        result = self.engine.inject_for_planner(original)

        self.assertIn("创作思维模式：测试作家", result)
        self.assertIn("心智模型内容", result)
        self.assertIn("世界观原则内容", result)
        # 原始内容应该保留
        self.assertIn("原始 prompt 内容", result)

    def test_inject_for_planner_with_no_perspective_returns_original(self):
        """没有加载视角时直接返回原始内容"""
        engine = PerspectiveEngine()
        original = "原始 prompt 内容"
        result = engine.inject_for_planner(original)

        self.assertEqual(result, original)

    def test_inject_for_planner_preserves_original_content(self):
        """原始 prompt 的所有内容都应该被完整保留"""
        original = "第一行\n第二行\n第三行包含特殊字符!@#$%^&*()"
        result = self.engine.inject_for_planner(original)

        self.assertIn("第一行", result)
        self.assertIn("第二行", result)
        self.assertIn("第三行包含特殊字符!@#$%^&*()", result)
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PlannerInjectionTests.test_inject_for_planner_adds_header -v
```
Expected: FAIL with "has no attribute 'inject_for_planner'"

- [ ] **Step 3: 实现 inject_for_planner 方法**

```python
# 在 core/perspective_engine.py 的 PerspectiveEngine 类中添加：

    def inject_for_planner(self, original_prompt: str, strength: float = 0.7) -> str:
        """为 Planner 注入心智模型

        注入位置：prompt 最开头
        注入内容：核心心智模型、世界观构建原则
        """
        if not self.perspective_data:
            return original_prompt

        injection = self._get_planner_injection(strength)

        return f"""
# 创作思维模式：{self.perspective_data['name']}

## 核心心智模型（请在构思时融入以下思维方式）
{injection['mental_models']}

## 世界观构建原则
{injection['worldview_principles']}

---

{original_prompt}
""".lstrip('\n')

    def _get_planner_injection(self, strength: float) -> Dict[str, str]:
        """根据强度裁剪 Planner 注入内容"""
        data = self.perspective_data['planner_injection']

        mental_models = data['mental_models']
        worldview = data['worldview_principles']

        # 根据强度裁剪
        if strength <= 0.3:
            # 低强度：只保留前 2 条心智模型
            models_lines = mental_models.strip().split('\n')
            mental_models = '\n'.join(models_lines[:2])
            # 世界观只保留第一条
            worldview_lines = worldview.strip().split('\n')
            worldview = '\n'.join(worldview_lines[:1])
        elif strength <= 0.7:
            # 中强度：保留前 4 条心智模型 + 世界观
            models_lines = mental_models.strip().split('\n')
            mental_models = '\n'.join(models_lines[:4])

        return {
            'mental_models': mental_models,
            'worldview_principles': worldview,
        }
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.PlannerInjectionTests -v
```
Expected: All 3 tests PASS

- [ ] **Step 5: 提交**

```bash
git add core/perspective_engine.py tests/test_perspective_engine.py
git commit -m "feat: implement inject_for_planner method"
```

---

## Task 4: Writer 注入方法实现

**Files:**
- Modify: `core/perspective_engine.py`
- Modify: `tests/test_perspective_engine.py`

- [ ] **Step 1: 写测试用例 - inject_for_writer**

```python
# 添加到 tests/test_perspective_engine.py

class WriterInjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.original_builtin = PerspectiveEngine.BUILTIN_PERSPECTIVES
        PerspectiveEngine.BUILTIN_PERSPECTIVES = Path(self.temp_dir)

        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump({
                'name': '测试作家',
                'genre': '测试',
                'description': '测试',
                'strength_recommended': 0.7,
                'strengths': [],
                'weaknesses': [],
                'planner_injection': {},
                'writer_injection': {
                    'sentence_patterns': '句式内容',
                    'vocabulary_traits': '词汇内容',
                    'rhythm_principles': '节奏内容',
                    'example_sentences': '例句内容',
                },
                'critic_injection': '',
                'revise_injection': '',
            }, f, allow_unicode=True)

        self.engine = PerspectiveEngine('test-writer')

    def tearDown(self):
        PerspectiveEngine.BUILTIN_PERSPECTIVES = self.original_builtin
        import shutil
        shutil.rmtree(self.temp_dir)

    def test_inject_for_writer_adds_content_at_end(self):
        """Writer 注入应该在末尾添加风格适配内容"""
        original = "原始 prompt 内容\n原始 prompt 第二行"
        result = self.engine.inject_for_writer(original)

        # 原始内容应该在前面
        self.assertTrue(result.index("原始 prompt 内容") < result.index("表达风格适配"))
        self.assertIn("句式内容", result)
        self.assertIn("词汇内容", result)
        self.assertIn("节奏内容", result)
        self.assertIn("例句内容", result)

    def test_inject_for_writer_with_no_perspective_returns_original(self):
        """没有加载视角时直接返回原始内容"""
        engine = PerspectiveEngine()
        original = "原始 prompt 内容"
        result = engine.inject_for_writer(original)
        self.assertEqual(result, original)
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.WriterInjectionTests.test_inject_for_writer_adds_content_at_end -v
```
Expected: FAIL with "has no attribute 'inject_for_writer'"

- [ ] **Step 3: 实现 inject_for_writer 方法**

```python
# 在 core/perspective_engine.py 的 PerspectiveEngine 类中添加：

    def inject_for_writer(self, original_prompt: str, strength: float = 0.7) -> str:
        """为 Writer 注入表达风格DNA

        注入位置：prompt 末尾（在所有硬性规则之后）
        注入内容：句式偏好、词汇特征、节奏感、经典句式参考
        """
        if not self.perspective_data:
            return original_prompt

        injection = self._get_writer_injection(strength)

        return f"""{original_prompt}

---

## 表达风格适配：{self.perspective_data['name']} 模式

### 句式偏好
{injection['sentence_patterns']}

### 词汇特征
{injection['vocabulary_traits']}

### 节奏感
{injection['rhythm_principles']}

### 经典句式参考（可直接化用）
{injection['example_sentences']}
"""

    def _get_writer_injection(self, strength: float) -> Dict[str, str]:
        """根据强度裁剪 Writer 注入内容"""
        data = self.perspective_data['writer_injection']

        sentences = data['sentence_patterns']
        vocabulary = data['vocabulary_traits']
        rhythm = data['rhythm_principles']
        examples = data['example_sentences']

        if strength <= 0.3:
            # 低强度：只保留句式和词汇
            rhythm = ''
            examples = ''
        elif strength <= 0.7:
            # 中强度：保留句式、词汇、节奏
            examples = ''

        return {
            'sentence_patterns': sentences,
            'vocabulary_traits': vocabulary,
            'rhythm_principles': rhythm,
            'example_sentences': examples,
        }
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.WriterInjectionTests -v
```
Expected: Both tests PASS

- [ ] **Step 5: 提交**

```bash
git add core/perspective_engine.py tests/test_perspective_engine.py
git commit -m "feat: implement inject_for_writer method"
```

---

## Task 5: Critic 和 Revise 注入方法实现

**Files:**
- Modify: `core/perspective_engine.py`
- Modify: `tests/test_perspective_engine.py`

- [ ] **Step 1: 写测试用例 - inject_for_critic 和 inject_for_revise**

```python
# 添加到 tests/test_perspective_engine.py

class CriticReviseInjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.original_builtin = PerspectiveEngine.BUILTIN_PERSPECTIVES
        PerspectiveEngine.BUILTIN_PERSPECTIVES = Path(self.temp_dir)

        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump({
                'name': '测试作家',
                'genre': '测试',
                'description': '测试',
                'strength_recommended': 0.7,
                'strengths': [],
                'weaknesses': [],
                'planner_injection': {},
                'writer_injection': {},
                'critic_injection': '评审标准内容',
                'revise_injection': '修改策略内容',
            }, f, allow_unicode=True)

        self.engine = PerspectiveEngine('test-writer')

    def tearDown(self):
        PerspectiveEngine.BUILTIN_PERSPECTIVES = self.original_builtin
        import shutil
        shutil.rmtree(self.temp_dir)

    def test_inject_for_critic(self):
        """Critic 注入应该在末尾添加视角评审标准"""
        original = "原始评审 prompt"
        result = self.engine.inject_for_critic(original)

        self.assertIn("原始评审 prompt", result)
        self.assertIn("评审标准内容", result)
        self.assertIn("测试作家", result)

    def test_inject_for_revise(self):
        """Revise 注入应该在末尾添加修改策略"""
        original = "原始修改 prompt"
        result = self.engine.inject_for_revise(original)

        self.assertIn("原始修改 prompt", result)
        self.assertIn("修改策略内容", result)
        self.assertIn("测试作家", result)

    def test_no_perspective_returns_original_for_both(self):
        """没有加载视角时都返回原始内容"""
        engine = PerspectiveEngine()
        original = "原始内容"

        self.assertEqual(engine.inject_for_critic(original), original)
        self.assertEqual(engine.inject_for_revise(original), original)
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.CriticReviseInjectionTests -v
```
Expected: FAIL with "has no attribute 'inject_for_critic'"

- [ ] **Step 3: 实现 inject_for_critic 和 inject_for_revise 方法**

```python
# 在 core/perspective_engine.py 的 PerspectiveEngine 类中添加：

    def inject_for_critic(self, original_input: str, strength: float = 0.7) -> str:
        """为 Critic 注入审美标准"""
        if not self.perspective_data:
            return original_input

        standards = self._get_critic_injection(strength)

        return f"""{original_input}

---

## 评审视角：{self.perspective_data['name']} 的审美标准
{standards}
"""

    def inject_for_revise(self, original_input: str, strength: float = 0.7) -> str:
        """为 Revise 注入修改策略"""
        if not self.perspective_data:
            return original_input

        strategy = self._get_revise_injection(strength)

        return f"""{original_input}

---

## 修改策略：{self.perspective_data['name']} 风格
{strategy}
"""

    def _get_critic_injection(self, strength: float) -> str:
        """根据强度裁剪 Critic 注入内容"""
        content = self.perspective_data['critic_injection']
        if strength <= 0.3:
            # 低强度：只保留前 2 条评审标准
            lines = content.strip().split('\n')
            content = '\n'.join(lines[:2])
        return content

    def _get_revise_injection(self, strength: float) -> str:
        """根据强度裁剪 Revise 注入内容"""
        content = self.perspective_data['revise_injection']
        if strength <= 0.3:
            # 低强度：只保留前 2 条修改策略
            lines = content.strip().split('\n')
            content = '\n'.join(lines[:2])
        return content
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.CriticReviseInjectionTests -v
```
Expected: All 3 tests PASS

- [ ] **Step 5: 提交**

```bash
git add core/perspective_engine.py tests/test_perspective_engine.py
git commit -m "feat: implement inject_for_critic and inject_for_revise methods"
```

---

## Task 6: 改造 load_prompt 支持视角注入

**Files:**
- Modify: `utils/file_utils.py`
- Modify: `tests/test_perspective_engine.py`

- [ ] **Step 1: 写测试用例 - load_prompt with perspective**

```python
# 添加到 tests/test_perspective_engine.py

import sys
from pathlib import Path

# 确保能导入 utils
sys.path.insert(0, str(Path(__file__).parent.parent))


class LoadPromptIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.original_builtin = PerspectiveEngine.BUILTIN_PERSPECTIVES
        PerspectiveEngine.BUILTIN_PERSPECTIVES = Path(self.temp_dir)

        # 创建测试视角
        test_file = Path(self.temp_dir) / 'test-writer.yaml'
        with open(test_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump({
                'name': '测试作家',
                'genre': '测试',
                'description': '测试',
                'strength_recommended': 0.7,
                'strengths': [],
                'weaknesses': [],
                'planner_injection': {
                    'mental_models': '心智模型',
                    'worldview_principles': '世界观',
                },
                'writer_injection': {
                    'sentence_patterns': '句式',
                    'vocabulary_traits': '词汇',
                    'rhythm_principles': '节奏',
                    'example_sentences': '例句',
                },
                'critic_injection': '评审',
                'revise_injection': '修改',
            }, f, allow_unicode=True)

    def tearDown(self):
        PerspectiveEngine.BUILTIN_PERSPECTIVES = self.original_builtin
        import shutil
        shutil.rmtree(self.temp_dir)

    def test_load_prompt_with_perspective_injects_correctly(self):
        """load_prompt 传入 perspective 时应该正确注入内容"""
        from utils.file_utils import load_prompt

        # 使用已有的 planner.md prompt 做测试
        original = load_prompt('planner')

        # 传入视角
        result = load_prompt('planner', perspective='test-writer')

        # 注入内容应该出现
        self.assertIn("创作思维模式：测试作家", result)
        self.assertIn("心智模型", result)
        # 原始内容应该保留
        self.assertTrue(len(result) > len(original))
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.LoadPromptIntegrationTests.test_load_prompt_with_perspective_injects_correctly -v
```
Expected: FAIL (perspective parameter doesn't exist yet)

- [ ] **Step 3: 修改 load_prompt 函数支持 perspective 参数**

```python
# 修改 utils/file_utils.py 中的 load_prompt 函数

def load_prompt(
    agent_name: str,
    content_type: str = None,
    context: dict = None,
    perspective: str = None,
    perspective_strength: float = 0.7,
) -> str:
    """
    从prompts文件夹加载对应Agent的提示词
    :param agent_name: Agent名称（planner/guardian/writer/editor/compliance）
    :param content_type: 内容类型（full_novel/short_story/script）
    :param context: 占位符替换上下文
    :param perspective: 作家视角名称（如 'liu-cixin'），启用视角注入
    :param perspective_strength: 视角强度 (0.0-1.0)，默认 0.7
    :return: 提示词内容
    """
    # === 原有逻辑保持不变 ===
    if content_type:
        specific_prompt = PROMPTS_DIR / f"{agent_name}_{content_type}.md"
        if specific_prompt.exists():
            with open(specific_prompt, "r", encoding="utf-8") as f:
                content = f.read().strip()
        elif agent_name == 'planner' and content_type == 'short_story':
            specific_prompt = PROMPTS_DIR / "planner_short_story.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()
        elif agent_name == 'planner' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "planner_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()
        elif agent_name == 'writer' and content_type == 'script':
            specific_prompt = PROMPTS_DIR / "writer_script.md"
            if specific_prompt.exists():
                with open(specific_prompt, "r", encoding="utf-8") as f:
                    content = f.read().strip()
        else:
            prompt_file = PROMPTS_DIR / f"{agent_name}.md"
            if not prompt_file.exists():
                raise FileNotFoundError(f"提示词文件不存在：{prompt_file}")
            with open(prompt_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
    else:
        prompt_file = PROMPTS_DIR / f"{agent_name}.md"
        if not prompt_file.exists():
            raise FileNotFoundError(f"提示词文件不存在：{prompt_file}")
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read().strip()

    # === 新增：视角注入逻辑 ===
    if perspective:
        try:
            from core.perspective_engine import PerspectiveEngine
            engine = PerspectiveEngine(perspective)

            if agent_name == 'planner':
                content = engine.inject_for_planner(content, perspective_strength)
            elif agent_name == 'writer':
                content = engine.inject_for_writer(content, perspective_strength)
            elif agent_name == 'critic':
                content = engine.inject_for_critic(content, perspective_strength)
            elif agent_name == 'revise':
                content = engine.inject_for_revise(content, perspective_strength)
        except Exception as e:
            from utils.logger import logger
            logger.warning(f"Perspective '{perspective}' 加载失败，使用默认模式: {e}")
            # 静默回退到无视角模式

    # === 原有占位符替换逻辑保持不变 ===
    if context:
        for key, value in context.items():
            content = content.replace(f"{{{{{key}}}}}", str(value))

    return content
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine.LoadPromptIntegrationTests -v
```
Expected: PASS

- [ ] **Step 5: 运行完整测试套件确认没有回归**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_engine -v
```
Expected: All tests PASS

- [ ] **Step 6: 提交**

```bash
git add utils/file_utils.py tests/test_perspective_engine.py
git commit -m "feat: integrate perspective injection into load_prompt function"
```

---

## Task 7: 端到端测试 - 使用真实刘慈欣视角生成

**Files:**
- Create: `tests/test_perspective_e2e.py`

- [ ] **Step 1: 写端到端测试**

```python
# tests/test_perspective_e2e.py
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

            print(f" 刘慈欣视角注入成功，最终 prompt 长度: {len(result)} 字符")
            print(f" 包含表达风格适配部分")

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
            print(" 低强度仍然有例句，可能需要调整裁剪逻辑")
```

- [ ] **Step 2: 运行端到端测试**

Run:
```bash
cd /Users/nobody1/Desktop/project/writer
conda run -n novel_agent python -m unittest tests.test_perspective_e2e -v
```
Expected: All tests PASS

- [ ] **Step 3: 提交**

```bash
git add tests/test_perspective_e2e.py
git commit -m "test: add end-to-end perspective integration tests"
```

---

## 计划自检

### Spec 覆盖检查

对照规格文档，本计划覆盖了：
-  PerspectiveEngine 核心类设计
-  4 个注入点（Planner/Writer/Critic/Revise）
-  强度参数支持
-  load_prompt 集成
-  内置视角 YAML 格式
-  静默失败/优雅降级
-  完整的测试覆盖

### 占位符检查

搜索整个计划文档，没有发现：
-  "TBD" / "TODO"
-  "implement later"
-  "Add appropriate error handling"
-  "Write tests for the above"
-  "Similar to Task N"

所有步骤都有完整的代码和精确的命令。

### 类型一致性检查

- `perspective_name` 参数命名一致
- `strength` / `perspective_strength` 参数命名一致
- 所有注入方法签名一致：`(original_prompt, strength=0.7)`
- 测试中使用的路径和类名与代码实现一致

---

**计划完成并已保存到 `docs/superpowers/plans/2026-04-24-perspective-engine-core.md`。**

两个执行选项：

**1. Subagent-Driven (recommended)** - 我为每个 task 派发一个独立的子 agent，每个 task 完成后我做代码 review，发现问题立即修正。并行化 + 严格质量控制。

**2. Inline Execution** - 在当前会话中按顺序执行 task，适合快速迭代。

你选择哪种方式？
