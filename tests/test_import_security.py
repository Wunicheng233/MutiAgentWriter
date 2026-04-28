"""测试：确保模块导入路径正确，防止重构时认证失效"""
import ast
import inspect


def test_get_current_user_direct_import():
    """测试：perspectives.py 应该直接从 backend.deps 导入 get_current_user"""
    # 读取 perspectives.py 文件并解析 AST
    with open('backend/api/perspectives.py', 'r') as f:
        source = f.read()

    tree = ast.parse(source)

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            # 检查 from backend.api.auth import get_current_user 这种写法
            if node.module == 'backend.api.auth':
                for name in node.names:
                    if name.name == 'get_current_user':
                        raise AssertionError(
                            "get_current_user 不应该通过 backend.api.auth 间接导入。\n"
                            "应该直接从 backend.deps 导入：\n"
                            "from backend.deps import get_current_user\n\n"
                            "间接导入链可能导致未来重构时认证失效：如果 auth.py 不再导出，\n"
                            "perspectives.py 的导入就会失败。"
                        )



def test_all_routers_have_proper_auth():
    """测试：perspectives 的所有非公开路由都有认证"""
    from fastapi.routing import APIRoute
    from backend.api.perspectives import router

    public_paths = ['/perspectives', '/perspectives/{perspective_id}']  # 允许未认证访问的路径

    for route in router.routes:
        if isinstance(route, APIRoute):
            path = route.path
            # 检查是否有认证依赖
            has_auth = any(
                'get_current_user' in str(dep)
                for dep in route.dependencies
            )

            # 检查路由函数参数中是否有 get_current_user
            func_sig = inspect.signature(route.endpoint)
            has_auth_in_params = any(
                'get_current_user' in str(param.default)
                for param in func_sig.parameters.values()
            )

            if path not in public_paths:
                assert has_auth or has_auth_in_params, (
                    f"路径 {path} 缺少认证保护！"
                    f"如果这个路径应该是公开的，请添加到 public_paths 列表中。"
                )
