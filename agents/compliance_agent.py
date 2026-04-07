from utils.volc_engine import call_volc_api
from utils.logger import logger

def check_compliance(content: str) -> str:
    logger.info("⚠️  合规&风控Agent正在校验...")
    return call_volc_api("compliance", content, temperature=0.1)