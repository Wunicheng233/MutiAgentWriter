import logging
import sys
from config import LOG_FILE

def setup_logger(name: str = "novel_system") -> logging.Logger:
    """
    配置并返回日志记录器
    :param name: 日志记录器名称
    :return: 配置好的Logger对象
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # 避免重复输出

    # 如果已经有handler，直接返回
    if logger.handlers:
        return logger

    # 日志格式
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # 控制台输出Handler（只输出INFO及以上）
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 文件输出Handler（输出DEBUG及以上，按日期分割）
    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# 全局日志记录器，直接导入使用
logger = setup_logger()