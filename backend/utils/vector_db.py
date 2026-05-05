"""
向量数据库工具 - 惰性加载版本
解决 macOS + Celery prefork 下的 fork 安全问题
所有重量级导入延迟到第一次使用时才进行
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from backend.core.config import settings
from backend.utils.logger import logger
from backend.utils.runtime_context import (
    get_current_output_dir,
    get_current_output_dir_optional,
    get_current_run_context_optional,
)
from typing import Optional, Any

# ===================== 全局配置（只存配置，不初始化） =====================
VECTOR_CHUNK_SIZE = settings.vector_chunk_size

# 向量库持久化路径
CHROMA_DB_PATH = settings.root_dir / "vector_db"
CHROMA_DB_PATH.mkdir(exist_ok=True, parents=True)

# 嵌入模型配置
DEFAULT_EMBEDDING_MODEL = "uer/sbert-base-chinese-nli"

# ===================== 惰性单例实例（初始化前都是None） =====================
_chroma_client: Optional[Any] = None
_embedding_func: Optional[Any] = None


def _get_chromadb():
    """惰性导入 chromadb，第一次使用时才导入"""
    global _chromadb
    if '_chromadb' not in globals():
        import chromadb
        _chromadb = chromadb
    return _chromadb


def _get_embedding_functions():
    """惰性导入 embedding_functions，第一次使用时才导入"""
    global _embedding_functions
    if '_embedding_functions' not in globals():
        from chromadb.utils import embedding_functions
        _embedding_functions = embedding_functions
    return _embedding_functions


def _get_client() -> Any:
    """惰性获取 ChromaDB 客户端，第一次调用时才创建"""
    global _chroma_client
    if _chroma_client is None:
        chromadb = _get_chromadb()
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
    return _chroma_client


def _get_embedding_func() -> Any:
    """惰性获取嵌入函数，第一次调用时才创建"""
    global _embedding_func
    if _embedding_func is None:
        embedding_functions = _get_embedding_functions()
        _embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=DEFAULT_EMBEDDING_MODEL
        )
    return _embedding_func


# ===================== 集合名称获取 =====================

MAX_CHROMA_COLLECTION_NAME_LENGTH = 63


def _sanitize_collection_component(value: str) -> str:
    """Return a Chroma-safe collection name component."""
    safe_value = re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_-").lower()
    return safe_value or "unnamed"


def _short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]


def _namespace_from_output_dir(output_dir: Path) -> str:
    """Build a stable path-based namespace for legacy/non-DB contexts."""
    resolved = str(output_dir.expanduser().resolve())
    slug = _sanitize_collection_component(output_dir.name)
    return f"{slug}_{_short_hash(resolved)}"


def _get_current_vector_namespace() -> str | None:
    """
    Return the namespace used to isolate project-scoped vector collections.

    Production tasks should carry a RunContext with project_id, which is the
    strongest stable identifier. Path hashing is a compatibility fallback for
    CLI/local flows that do not have a database project yet.
    """
    run_context = get_current_run_context_optional()
    if run_context and run_context.project_id is not None:
        return f"project_{run_context.project_id}"

    current_output_dir = get_current_output_dir_optional()
    if current_output_dir is None:
        return None

    return _namespace_from_output_dir(current_output_dir)


def _build_collection_name(prefix: str, namespace: str | None, default_name: str) -> str:
    if namespace is None:
        return default_name

    sanitized_namespace = _sanitize_collection_component(namespace)
    max_namespace_length = MAX_CHROMA_COLLECTION_NAME_LENGTH - len(prefix) - 1
    if len(sanitized_namespace) > max_namespace_length:
        suffix = _short_hash(sanitized_namespace)
        base_length = max_namespace_length - len(suffix) - 1
        sanitized_namespace = f"{sanitized_namespace[:base_length].rstrip('_-')}_{suffix}"

    return f"{prefix}_{sanitized_namespace}"


def _get_current_chapter_collection_name():
    """获取当前小说专属的章节collection名称"""
    return _build_collection_name(
        prefix="chapters",
        namespace=_get_current_vector_namespace(),
        default_name="novel_chapter_content_default",
    )


def _get_current_setting_collection_name():
    """获取当前小说专属的设定collection名称"""
    return _build_collection_name(
        prefix="settings",
        namespace=_get_current_vector_namespace(),
        default_name="novel_world_setting_default",
    )


def _get_reference_collection_name():
    """文风参考范例collection，全局共享"""
    return "style_references"


def get_reference_collection():
    client = _get_client()
    embed = _get_embedding_func()
    return client.get_or_create_collection(
        name=_get_reference_collection_name(),
        embedding_function=embed,
        metadata={"description": "用户提供的优秀文风参考范例"}
    )


def get_chapter_collection():
    client = _get_client()
    embed = _get_embedding_func()
    current_output_dir = get_current_output_dir_optional()
    return client.get_or_create_collection(
        name=_get_current_chapter_collection_name(),
        embedding_function=embed,
        metadata={"description": f"章节内容 - {current_output_dir.name if current_output_dir else 'default'}"}
    )


def get_setting_collection():
    client = _get_client()
    embed = _get_embedding_func()
    current_output_dir = get_current_output_dir_optional()
    return client.get_or_create_collection(
        name=_get_current_setting_collection_name(),
        embedding_function=embed,
        metadata={"description": f"核心设定 - {current_output_dir.name if current_output_dir else 'default'}"}
    )


def _is_missing_collection_error(error: Exception) -> bool:
    return error.__class__.__name__ == "NotFoundError" or "does not exist" in str(error)


def _delete_collection_if_exists(client: Any, name: str) -> bool:
    try:
        client.delete_collection(name=name)
        return True
    except Exception as error:
        if _is_missing_collection_error(error):
            logger.debug("向量数据库集合不存在，跳过删除: %s", name)
            return False
        raise


def reset_current_db():
    """重置当前小说的向量数据库，新建小说时调用"""
    try:
        client = _get_client()
        deleted_any = False
        for collection_name in (
            _get_current_chapter_collection_name(),
            _get_current_setting_collection_name(),
        ):
            deleted_any = _delete_collection_if_exists(client, collection_name) or deleted_any
        if deleted_any:
            logger.info("✅ 当前小说向量数据库已重置")
        else:
            logger.info("当前小说向量数据库无需重置")
    except Exception as e:
        logger.error(f"Vector DB 操作失败: {e}", exc_info=True)


# ===================== 标准化写入函数 =====================
def add_chapter_to_db(
    chapter_num: int,
    chapter_title: str,
    content: str,
    chunk_size: int = VECTOR_CHUNK_SIZE
):
    """
    标准化写入章节内容到向量库，强制校验必填字段
    :param chapter_num: 章节号（必填，int类型）
    :param chapter_title: 章节标题（必填）
    :param content: 章节完整正文
    :param chunk_size: 内容分块大小，默认从配置读取
    """
    chapter_collection = get_chapter_collection()
    # 1. 内容分块处理
    if not content.strip():
        logger.warning("章节内容为空，跳过存入向量库")
        return
    chunks = [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]
    chunk_count = len(chunks)

    # 2. 标准化ID与元数据（必填字段强制填充，绝对不会缺失）
    ids = [f"chapter_{chapter_num}_chunk_{i}" for i in range(chunk_count)]
    metadatas = [
        {
            "chapter_num": chapter_num,
            "chapter_title": chapter_title,
            "chunk_id": i,
            "total_chunk": chunk_count
        }
        for i in range(chunk_count)
    ]

    # 3. 写入向量库
    try:
        chapter_collection.upsert(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )
        logger.info(f"✅ 第{chapter_num}章《{chapter_title}》已同步到向量库，共{chunk_count}个数据块")
    except Exception as e:
        logger.error(f"❌ 章节存入向量库失败：{str(e)}")
        raise


# ===================== 安全检索 =====================
def search_related_chapter_content(
    query: str,
    top_k: int = 5,
    max_chapter_num: int = None
) -> str:
    """
    安全检索相关历史章节内容，绝对不会出现KeyError
    :param query: 检索关键词/当前剧情
    :param top_k: 返回最相关的前N条
    :param max_chapter_num: 最大章节号（仅检索当前章节之前的内容，避免剧透）
    :return: 格式化后的相关内容字符串
    """
    chapter_collection = get_chapter_collection()
    # 检索过滤条件：仅检索当前章节之前的内容
    filter_condition = None
    if max_chapter_num is not None:
        filter_condition = {"chapter_num": {"$lt": max_chapter_num}}

    # 执行检索
    try:
        results = chapter_collection.query(
            query_texts=[query],
            n_results=top_k,
            where=filter_condition
        )
    except Exception as e:
        logger.error(f"❌ 内容检索失败：{str(e)}")
        return "无相关历史内容"

    # 无结果处理
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    if not documents:
        return "无相关历史内容"

    # 安全格式化结果
    related_content = "\n【相关历史章节内容】\n"
    for doc, meta in zip(documents, metadatas):
        chapter_num = meta.get("chapter_num", "未知章节")
        chapter_title = meta.get("chapter_title", "未知标题")
        related_content += f"▶ 第{chapter_num}章《{chapter_title}》：{doc.strip()}\n"

    logger.info(f"🔍 已检索到{len(documents)}条相关历史内容")
    return related_content


# ===================== 设定圣经写入/检索 =====================
def load_setting_bible_to_db():
    """把设定圣经存入向量库，标准化元数据，避免和章节内容混存"""
    output_dir = get_current_output_dir()
    setting_path = output_dir / "setting_bible.md"
    if not setting_path.exists():
        logger.warning("⚠️ 设定圣经文件不存在，暂不存入数据库")
        return

    try:
        with open(setting_path, "r", encoding="utf-8") as f:
            setting_content = f.read().strip()

        setting_collection = get_setting_collection()
        # 标准化写入设定Collection，和章节内容完全隔离
        setting_collection.upsert(
            documents=[setting_content],
            ids=["core_setting_bible"],
            metadatas=[{"setting_type": "core_bible", "version": "1.0"}]
        )
        logger.info("✅ 核心设定圣经已同步到向量库")
    except Exception as e:
        logger.error(f"❌ 设定圣经存入失败：{str(e)}")


def search_core_setting(query: str, top_k: int = 3) -> str:
    """检索核心设定内容，和章节检索隔离，避免混出无关内容"""
    setting_collection = get_setting_collection()
    try:
        results = setting_collection.query(
            query_texts=[query],
            n_results=top_k
        )
    except Exception as e:
        logger.error(f"❌ 设定检索失败：{str(e)}")
        return "无相关核心设定"

    documents = results["documents"][0]
    if not documents:
        return "无相关核心设定"

    related_content = "\n【核心设定】\n"
    for doc in documents:
        related_content += f"{doc.strip()}\n"
    return related_content


def _get_current_skills_collection_name():
    """获取当前项目专属的skills collection名称"""
    return _build_collection_name(
        prefix="skills",
        namespace=_get_current_vector_namespace(),
        default_name="novel_skills_default",
    )


def get_skill_collection():
    client = _get_client()
    embed = _get_embedding_func()
    return client.get_or_create_collection(
        name=_get_current_skills_collection_name(),
        embedding_function=embed,
        metadata={"description": "Auto-generated writing skills (Hermes-style)"},
    )


def add_skill_to_db(
    skill_id: str,
    skill_name: str,
    content: str,
    skill_type: str = "general",
    target_character: str = "",
    confidence: float = 0.0,
    auto_generated: bool = True,
):
    """Index a skill in the vector DB for semantic retrieval.

    Args:
        skill_id: Unique skill ID (used as the document ID)
        skill_name: Human-readable skill name
        content: The skill body text (injection content) for semantic matching
        skill_type: character_style / writing_style / plot_helper / user_preference
        target_character: Character this skill targets (if any)
        confidence: Confidence score (0.0-1.0)
        auto_generated: Whether this skill was auto-generated
    """
    collection = get_skill_collection()
    try:
        collection.upsert(
            documents=[content],
            ids=[skill_id],
            metadatas=[{
                "skill_id": skill_id,
                "skill_name": skill_name,
                "skill_type": skill_type,
                "target_character": target_character,
                "confidence": confidence,
                "auto_generated": int(auto_generated),
            }],
        )
        logger.info(f"✅ 技能 '{skill_id}' 已同步到向量库 (type={skill_type})")
    except Exception as e:
        logger.error(f"❌ 技能存入向量库失败：{str(e)}")


def search_relevant_skills(
    query: str,
    top_k: int = 5,
    character_name: str | None = None,
    min_confidence: float = 0.0,
) -> list[dict[str, Any]]:
    """Semantically search for skills relevant to the current context.

    Args:
        query: Search query describing the current writing context
        top_k: Max results to return
        character_name: If set, filter skills targeting this character
        min_confidence: Minimum confidence threshold

    Returns:
        List of matched skill metadata dicts, sorted by relevance
    """
    collection = get_skill_collection()
    try:
        # Build ChromaDB filter
        filter_parts: list[dict[str, Any]] = []
        if character_name:
            filter_parts.append(
                {"target_character": {"$eq": character_name}}
            )

        filter_condition = None
        if filter_parts:
            filter_condition = {"$and": filter_parts} if len(filter_parts) > 1 else filter_parts[0]

        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where=filter_condition,
        )
    except Exception as e:
        logger.error(f"❌ 技能检索失败：{str(e)}")
        return []

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    if not documents:
        return []

    # Filter by confidence and return only metadata
    matched: list[dict[str, Any]] = []
    for doc, meta in zip(documents, metadatas):
        conf = meta.get("confidence", 0.0)
        if conf < min_confidence:
            continue
        matched.append({
            "skill_id": meta.get("skill_id", ""),
            "skill_name": meta.get("skill_name", ""),
            "skill_type": meta.get("skill_type", "general"),
            "target_character": meta.get("target_character", ""),
            "confidence": conf,
            "auto_generated": bool(meta.get("auto_generated", False)),
            "content_preview": doc[:200],
        })

    logger.info(f"🔍 已检索到 {len(matched)} 条相关技能")
    return matched


def remove_skill_from_db(skill_id: str) -> bool:
    """Remove a skill from the vector DB (e.g. when deleted)."""
    collection = get_skill_collection()
    try:
        collection.delete(ids=[skill_id])
        logger.info(f"✅ 技能 '{skill_id}' 已从向量库删除")
        return True
    except Exception as e:
        if _is_missing_collection_error(e):
            return False
        logger.error(f"❌ 技能删除失败：{str(e)}")
        return False
def init_reference_collection():
    """初始化文风参考集合，加载references目录下的所有txt文件"""
    reference_collection = get_reference_collection()
    REF_DIR = settings.root_dir / "references"
    REF_DIR.mkdir(exist_ok=True)

    # 检查是否已经有数据
    if reference_collection.count() > 0:
        logger.info(f"✅ 文风参考集合已初始化，共有{reference_collection.count()}条参考")
        return

    # 遍历加载所有txt文件
    count = 0
    for txt_file in REF_DIR.glob("*.txt"):
        with open(txt_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if content:
            # 完整保存内容（包括用户注释），注释会帮助AI理解学习目标
            reference_collection.upsert(
                documents=[content],
                ids=[txt_file.name],
                metadatas=[{"filename": txt_file.name}]
            )
            count += 1

    logger.info(f"✅ 文风参考集合初始化完成，加载了{count}条参考范例")


def search_reference_style(query: str, top_k: int = 2) -> str:
    """检索和当前query文风相似的优秀参考范例"""
    # 确保初始化
    init_reference_collection()
    reference_collection = get_reference_collection()

    if reference_collection.count() == 0:
        return ""

    try:
        results = reference_collection.query(
            query_texts=[query],
            n_results=top_k
        )
    except Exception as e:
        logger.error(f"❌ 文风参考检索失败：{str(e)}")
        return ""

    documents = results["documents"][0]
    if not documents:
        return ""

    related_content = "\n=========================================\n【优秀文风参考范例，请你认真学习这些范例的文笔节奏、表达方式、悬念设置，然后写出同样质感的文字】：\n"
    for i, doc in enumerate(documents, 1):
        related_content += f"\n--- 参考范例{i} ---\n{doc.strip()}\n"

    logger.info(f"🔍 已检索到{len(documents)}条文风参考范例")
    return related_content
