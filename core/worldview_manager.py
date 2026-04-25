import copy
import json
from utils.logger import logger
from utils.runtime_context import get_current_output_dir_optional
import config

# ===================== 世界观管控核心类 =====================
# 每本小说独立存储世界观状态，放在当前小说输出文件夹下
# 避免多本小说互相覆盖，真正隔离

class WorldviewManager:
    def __init__(self):
        # 世界观状态文件路径：outputs/{书名}/worldview_state.json
        self._update_file_path()
        # 初始化空的世界观状态结构（全题材通用，可无限扩展）
        self.default_state = {
            # 1. 小说基础信息（全局唯一，不可随意修改）
            "base_info": {
                "novel_name": "未命名小说",
                "genre": [],  # 题材标签，比如["重生", "工业", "爽文"]
                "total_chapters": 0,
                "core_theme": "",  # 核心主线
                "core_conflict": "",  # 核心冲突
                "custom_rules": []  # 用户自定义规则，比如"主角不能谈恋爱"
            },
            # 2. 全局时间线（解决时间倒流的核心）
            "timeline": {
                "base_time": "",  # 基准时间，比如"2015年6月18日"
                "current_time": "",  # 当前剧情推进到的时间
                "event_anchors": []  # 已发生的事件锚点，格式：{"time": "", "event": "", "chapter": 0}
            },
            # 3. 角色档案库（解决人设崩塌的核心）
            "characters": {},  # 格式：{"角色ID": {完整人设档案}}
            # 4. 世界观核心规则（解决设定前后矛盾的核心）
            "world_rules": {
                "forbidden_content": [],  # 禁止出现的内容
                "unchangeable_rules": []  # 不可打破的底层规则
            },
            # 5. 伏笔与事件追踪库（解决伏笔忘回收的核心）
            "foreshadows": []  # 格式：{"id": "", "content": "", "chapter": 0, "status": "unfinished/finished", "related_characters": []}
        }
        self.state = self._load_state()

    def _update_file_path(self):
        """更新文件路径到当前小说输出目录"""
        current_output_dir = get_current_output_dir_optional()
        if current_output_dir is None:
            # 还没设置输出目录，先存在core临时位置
            self.file_path = config.ROOT_DIR / "core" / "worldview_state.json"
        else:
            # 每本小说独立存储
            self.file_path = current_output_dir / "worldview_state.json"

    # ===================== 基础读写方法 =====================
    def _load_state(self) -> dict:
        """从本地JSON文件加载世界观状态，文件不存在则初始化默认值"""
        self._update_file_path()
        if not self.file_path.exists():
            logger.info("⚠️ 未找到世界观状态文件，初始化全新世界观")
            initial_state = copy.deepcopy(self.default_state)
            self._save_state(initial_state)
            return initial_state

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                state = json.load(f)
            logger.info("✅ 世界观状态加载成功")
            return state
        except json.JSONDecodeError as e:
            logger.error(f"❌ 世界观状态JSON解析失败，使用默认值：{str(e)}")
            return copy.deepcopy(self.default_state)
        except OSError as e:
            logger.error(f"❌ 世界观状态文件读取失败，使用默认值：{str(e)}")
            return copy.deepcopy(self.default_state)
        except Exception as e:
            logger.error(f"❌ 世界观状态加载失败，使用默认值：{str(e)}")
            return copy.deepcopy(self.default_state)

    def _save_state(self, state: dict):
        """把世界观状态保存到本地JSON文件，持久化存储"""
        try:
            self._update_file_path()
            # 确保文件夹存在
            self.file_path.parent.mkdir(exist_ok=True, parents=True)
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=4)
        except Exception as e:
            logger.error(f"❌ 世界观状态保存失败：{str(e)}")
            raise

    def reset_worldview(self):
        """重置世界观，用于新建小说项目"""
        logger.info("🔄 正在重置世界观（新建小说）")
        self._update_file_path()  # 重置时更新路径到当前小说输出目录
        self.state = copy.deepcopy(self.default_state)
        self._save_state(self.state)
        logger.info("✅ 世界观重置完成")
        logger.info(f"📁 世界观状态存储位置：{self.file_path}")

    # ===================== 核心管控方法（生成前强制约束） =====================
    def get_generation_constraints(self, current_chapter: int) -> dict:
        """
        获取当前章节生成的强制约束清单，所有Agent生成前必须调用
        :param current_chapter: 当前要生成的章节号
        :return: 格式化后的约束字典，直接传给大模型
        """
        constraints = {
            "base_info": self.state["base_info"],
            "current_time": self.state["timeline"]["current_time"],
            "already_happened_events": self.state["timeline"]["event_anchors"],
            "characters_info": self.state["characters"],
            "world_rules": self.state["world_rules"],
            "unfinished_foreshadows": [f for f in self.state["foreshadows"] if f["status"] == "unfinished"],
            "current_chapter": current_chapter,
            "forbidden": f"绝对不允许出现时间倒流、人设崩塌、违反世界观规则的内容，仅能使用第{current_chapter}章之前的已发生事件"
        }
        logger.info(f"✅ 已生成第{current_chapter}章的强制约束清单")
        return constraints

    # ===================== 状态更新方法（生成后自动同步） =====================
    def update_timeline(self, new_time: str, new_event: str, chapter_num: int):
        """更新全局时间线，每章生成后必须调用，彻底解决时间线混乱"""
        # 新增事件锚点
        self.state["timeline"]["event_anchors"].append({
            "time": new_time,
            "event": new_event,
            "chapter": chapter_num
        })
        # 更新当前推进时间
        self.state["timeline"]["current_time"] = new_time
        self._save_state(self.state)
        logger.info(f"✅ 全局时间线已更新，当前推进至：{new_time}")

    def add_character(self, character_id: str, character_info: dict):
        """新增角色档案，角色ID唯一，不可重复"""
        if character_id in self.state["characters"]:
            logger.warning(f"⚠️ 角色{character_id}已存在，跳过新增")
            return
        self.state["characters"][character_id] = character_info
        self._save_state(self.state)
        logger.info(f"✅ 角色{character_id}档案已存入世界观中枢")

    def update_character(self, character_id: str, update_info: dict):
        """更新角色状态，比如角色成长、关系变化，确保人设连贯"""
        if character_id not in self.state["characters"]:
            logger.error(f"❌ 角色{character_id}不存在，无法更新")
            return
        self.state["characters"][character_id].update(update_info)
        self._save_state(self.state)
        logger.info(f"✅ 角色{character_id}档案已更新")

    def add_foreshadow(self, foreshadow_id: str, content: str, chapter_num: int, related_characters: list = None):
        """新增伏笔，自动追踪状态"""
        self.state["foreshadows"].append({
            "id": foreshadow_id,
            "content": content,
            "chapter": chapter_num,
            "status": "unfinished",
            "related_characters": related_characters or []
        })
        self._save_state(self.state)
        logger.info(f"✅ 新增伏笔{foreshadow_id}，已纳入追踪")

    def finish_foreshadow(self, foreshadow_id: str, finish_chapter: int):
        """标记伏笔已回收，避免伏笔烂尾"""
        for foreshadow in self.state["foreshadows"]:
            if foreshadow["id"] == foreshadow_id:
                foreshadow["status"] = "finished"
                foreshadow["finish_chapter"] = finish_chapter
                self._save_state(self.state)
                logger.info(f"✅ 伏笔{foreshadow_id}已在第{finish_chapter}章回收")
                return
        logger.warning(f"⚠️ 未找到伏笔{foreshadow_id}，无法标记完成")

# ===================== 注意：不再提供模块级单例 =====================
# 使用方应按需实例化 WorldviewManager(output_dir)
# 这样可以避免多任务/多项目并行时的状态交叉污染
