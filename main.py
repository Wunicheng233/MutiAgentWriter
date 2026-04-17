"""
多Agent AI小说创作系统 - 命令行入口
重构后：核心逻辑在 core.orchestrator.NovelOrchestrator
"""

import sys
from core.orchestrator import NovelOrchestrator


def main(progress_callback=None, task_id=None, generation_tasks=None):
    """
    主入口，保持向后兼容原有接口
    progress_callback: 回调函数 f(percent: int, message: str) -> None
    task_id: Web任务ID（Web模式下确认策划时需要）
    generation_tasks: Web任务状态存储（Web模式下确认策划时需要）
    """
    project_dir = None
    if len(sys.argv) > 1:
        project_dir = sys.argv[1]

    orchestrator = NovelOrchestrator(project_dir, progress_callback=progress_callback)

    # 处理Web模式下的确认处理
    if progress_callback and task_id is not None and generation_tasks is not None:
        from threading import Event

        def web_confirmation_handler(plan_preview):
            """Web模式下的确认处理，通过generation_tasks同步"""
            confirmation_event = Event()
            generation_tasks[task_id]['confirmation_waiting'] = True
            generation_tasks[task_id]['plan_preview'] = plan_preview
            generation_tasks[task_id]['confirmation_event'] = confirmation_event
            confirmation_event.wait()
            confirmation = generation_tasks[task_id].get('confirmation')
            feedback = generation_tasks[task_id].get('feedback')
            generation_tasks[task_id]['confirmation_waiting'] = False
            if 'confirmation_event' in generation_tasks[task_id]:
                del generation_tasks[task_id]['confirmation_event']
            return confirmation == 'y', feedback
    else:
        web_confirmation_handler = None

    result = orchestrator.run_full_novel(confirmation_handler=web_confirmation_handler)
    return result


if __name__ == "__main__":
    main()
