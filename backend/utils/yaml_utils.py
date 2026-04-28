import yaml
from backend.config import USER_REQUIREMENTS_FILE
from backend.utils.logger import logger

def load_user_requirements() -> dict:
    """
    从user_requirements.yaml加载用户需求
    :return: 需求字典
    """
    if not USER_REQUIREMENTS_FILE.exists():
        logger.error(f"用户需求配置文件不存在：{USER_REQUIREMENTS_FILE}")
        raise FileNotFoundError(f"请先创建用户需求配置文件：{USER_REQUIREMENTS_FILE}")
    
    with open(USER_REQUIREMENTS_FILE, "r", encoding="utf-8") as f:
        try:
            requirements = yaml.safe_load(f)
            logger.info("用户需求配置文件加载成功")
            logger.debug(f"加载的需求：{requirements}")
            return requirements
        except yaml.YAMLError as e:
            logger.error(f"用户需求配置文件解析失败：{e}")
            raise