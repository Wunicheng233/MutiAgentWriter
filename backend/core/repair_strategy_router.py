"""
修复策略路由器

职责：
- 根据问题类型和严重程度选择最佳修复策略
- 策略分类：局部修复 vs 整章重写
"""

from typing import Dict, List, Any
from backend.utils.logger import logger


# 修复策略类型
STRATEGY_LOCAL_PATCH = "local_patch"
STRATEGY_STYLE_REPAIR = "style_repair"
STRATEGY_FULL_REWRITE = "full_rewrite"
STRATEGY_CHARACTER_CONSISTENCY = "character_consistency"


class RepairStrategyRouter:
    """修复策略路由器"""

    # 问题类型到策略的映射
    STRATEGY_MAPPING = {
        "plot_hole": STRATEGY_FULL_REWRITE,
        "character_inconsistency": STRATEGY_CHARACTER_CONSISTENCY,
        "pacing_issue": STRATEGY_LOCAL_PATCH,
        "dialogue_issue": STRATEGY_LOCAL_PATCH,
        "style_mismatch": STRATEGY_STYLE_REPAIR,
        "setting_inconsistency": STRATEGY_CHARACTER_CONSISTENCY,
        "continuity_error": STRATEGY_LOCAL_PATCH,
    }

    # 默认策略
    DEFAULT_STRATEGY = STRATEGY_STYLE_REPAIR

    def __init__(self):
        self.route_log: List[Dict[str, Any]] = []

    def route(self, issue: Dict[str, Any]) -> str:
        """
        为单个问题选择修复策略

        Args:
            issue: Critic 发现的问题字典

        Returns:
            修复策略名称
        """
        issue_type = issue.get("type", issue.get("issue_type", "unknown"))
        severity = issue.get("severity", "medium")

        # 根据严重程度调整策略
        strategy = self._get_strategy_for_type(issue_type)

        # 严重问题升级策略
        if severity == "critical" and strategy in (STRATEGY_LOCAL_PATCH, STRATEGY_STYLE_REPAIR):
            strategy = STRATEGY_FULL_REWRITE

        self.route_log.append({
            "issue_type": issue_type,
            "severity": severity,
            "assigned_strategy": strategy,
        })

        logger.debug(f"问题类型: {issue_type}, 严重程度: {severity}, 策略: {strategy}")
        return strategy

    def route_batch(self, issues: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        批量路由一组问题，按策略分组

        Args:
            issues: 问题列表

        Returns:
            按策略分组的问题字典: {策略名: [问题列表]}
        """
        grouped: Dict[str, List[Dict[str, Any]]] = {}

        for issue in issues:
            strategy = self.route(issue)
            if strategy not in grouped:
                grouped[strategy] = []
            grouped[strategy].append(issue)

        # 记录路由决策
        for strategy, strategy_issues in grouped.items():
            logger.info(f"策略 {strategy}: {len(strategy_issues)} 个问题")

        return grouped

    def should_use_local_repair(self, issues: List[Dict[str, Any]]) -> bool:
        """
        判断这组问题是否适合使用本地修复

        Args:
            issues: 问题列表

        Returns:
            True 如果应该使用本地修复，False 否则
        """
        if not issues:
            return False

        # 问题数量太多，建议整章重写
        if len(issues) > 5:
            logger.info(f"问题数量 {len(issues)} 过多，建议整章重写")
            return False

        # 检查是否有严重问题
        for issue in issues:
            severity = issue.get("severity", "medium")
            if severity == "critical":
                logger.info("存在严重问题，建议整章重写")
                return False

        return True

    def _get_strategy_for_type(self, issue_type: str) -> str:
        """根据问题类型获取策略"""
        # 模糊匹配
        for key, strategy in self.STRATEGY_MAPPING.items():
            if key in issue_type.lower() or issue_type.lower() in key:
                return strategy

        return self.DEFAULT_STRATEGY

    def get_route_summary(self) -> Dict[str, int]:
        """获取路由决策统计"""
        summary: Dict[str, int] = {}
        for log in self.route_log:
            strategy = log["assigned_strategy"]
            summary[strategy] = summary.get(strategy, 0) + 1
        return summary
