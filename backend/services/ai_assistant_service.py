"""
AI Assistant Service Layer

Extensibility Points:
- context_enricher(): Inject project/chapter context for contextual responses
- agent_router(): Route to specialized agents based on query type
- tool_calling_middleware(): Add function calling support
"""
from backend.utils.volc_engine import call_volc_api


class AIAssistantService:
    """
    AI Assistant service for handling chat requests.

    This service provides a clean separation between API layer
    and LLM infrastructure, designed for future extensibility.
    """

    @staticmethod
    def chat(user_input: str, context: dict = None) -> str:
        """
        Process a chat request and return AI response.

        Args:
            user_input: The user's message
            context: Optional context dictionary for future features
                    Can contain: project_id, current_chapter, genre, etc.

        Returns:
            AI-generated response string
        """
        # TODO: Add context enrichment here for Phase 1
        # TODO: Add agent routing here for Phase 2
        # TODO: Add tool calling middleware here for Phase 3

        result = call_volc_api(
            agent_role="assistant",
            user_input=user_input,
            context=context or {},
        )

        return result
