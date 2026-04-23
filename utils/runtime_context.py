"""
运行时上下文

当前仍保留 `config.CURRENT_OUTPUT_DIR` 作为旧代码兼容层，但新代码应优先通过
这里的 ContextVar 读取当前项目输出目录，避免多个任务共享同一个模块级可变状态。
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Iterator

import config


_current_output_dir: ContextVar[Path | None] = ContextVar("current_output_dir", default=None)


def set_current_output_dir(output_dir: Path | str | None) -> Path | None:
    path = Path(output_dir) if output_dir is not None else None
    _current_output_dir.set(path)
    # 兼容仍直接读取 config.CURRENT_OUTPUT_DIR 的旧代码。
    config.CURRENT_OUTPUT_DIR = path
    return path


def get_current_output_dir_optional() -> Path | None:
    context_output_dir = _current_output_dir.get()
    if context_output_dir is not None:
        return context_output_dir
    return config.CURRENT_OUTPUT_DIR


def get_current_output_dir() -> Path:
    output_dir = get_current_output_dir_optional()
    if output_dir is None:
        raise RuntimeError("当前输出目录未设置，请先设置运行时上下文")
    return output_dir


@contextmanager
def use_output_dir(output_dir: Path | str | None) -> Iterator[Path | None]:
    previous_config_output_dir = config.CURRENT_OUTPUT_DIR
    token = _current_output_dir.set(Path(output_dir) if output_dir is not None else None)
    config.CURRENT_OUTPUT_DIR = _current_output_dir.get()
    try:
        yield _current_output_dir.get()
    finally:
        _current_output_dir.reset(token)
        config.CURRENT_OUTPUT_DIR = previous_config_output_dir
