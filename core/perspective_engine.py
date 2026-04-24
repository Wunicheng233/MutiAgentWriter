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
