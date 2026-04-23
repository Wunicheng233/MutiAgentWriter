import unittest

from core.agent_contract import get_agent_contract, list_agent_contracts


class AgentContractTests(unittest.TestCase):
    def test_core_agent_contracts_cover_current_slim_runtime(self):
        contracts = {contract.agent_key: contract for contract in list_agent_contracts()}
        self.assertEqual(set(contracts), {"critic", "planner", "revise", "writer"})

        self.assertEqual(contracts["planner"].prompt_template_key, "planner")
        self.assertIn("planning", contracts["planner"].supported_workflow_nodes)
        self.assertEqual(contracts["writer"].output_schema_ref, "ChapterDraftArtifact.v1")
        self.assertEqual(contracts["critic"].retry_policy_key, "strict_json_retry")
        self.assertIn("feedback_revision", contracts["revise"].supported_workflow_nodes)

        for contract in contracts.values():
            self.assertEqual(contract.model_policy_key, contract.agent_key)
            self.assertTrue(contract.input_schema_ref.endswith(".v1"))
            self.assertTrue(contract.output_schema_ref.endswith(".v1"))

    def test_unknown_agent_contract_fails_explicitly(self):
        with self.assertRaises(KeyError):
            get_agent_contract("guardian")


if __name__ == "__main__":
    unittest.main()
