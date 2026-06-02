"""
Unit tests for the wake Lambda handler.
Covers the MCP service waking behaviour added in issue #105.
"""
import json
import os
import time
import types
import unittest
from unittest.mock import MagicMock, call, patch

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _post_event(secret="test-secret"):
    return {
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({"secret": secret}),
    }


def _make_ssm_client(secret="test-secret", on_cooldown=False):
    ssm = MagicMock()

    def get_parameter(Name, **kwargs):
        if "wake-secret" in Name:
            return {"Parameter": {"Value": secret}}
        if "wake-last-triggered" in Name:
            if on_cooldown:
                return {"Parameter": {"Value": str(time.time() - 10)}}
            # Raise ParameterNotFound so cooldown returns False
            exc_cls = type(
                "ParameterNotFound",
                (Exception,),
                {},
            )
            ssm.exceptions = types.SimpleNamespace(ParameterNotFound=exc_cls)
            raise exc_cls("not found")

    ssm.get_parameter.side_effect = get_parameter
    ssm.put_parameter = MagicMock()

    # Attach exceptions namespace used in is_on_cooldown
    not_found_cls = type("ParameterNotFound", (Exception,), {})
    ssm.exceptions = types.SimpleNamespace(ParameterNotFound=not_found_cls)
    return ssm


def _make_ecs_client():
    ecs = MagicMock()
    ecs.update_service = MagicMock(return_value={})
    return ecs


def _make_rds_client(status="stopped"):
    rds = MagicMock()
    rds.describe_db_instances.return_value = {
        "DBInstances": [{"DBInstanceStatus": status}]
    }
    rds.start_db_instance = MagicMock(return_value={})
    return rds


# ---------------------------------------------------------------------------
# Environment setup
# ---------------------------------------------------------------------------

BASE_ENV = {
    "ENV": "dev",
    "CLUSTER_NAME": "my-cluster",
    "SERVICE_NAME": "backend-svc",
    "MCP_SERVICE_NAME": "mcp-svc",
    "RDS_INSTANCE_ID": "my-rds",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWakeHandlerMcpService(unittest.TestCase):
    """Issue #105 — wake Lambda must start both backend and MCP services."""

    def _run_handler(self, ssm, ecs, rds):
        """Import handler fresh each test to avoid module-level caching issues."""
        import importlib
        import sys
        # Remove cached module so env vars are re-read
        sys.modules.pop("index", None)

        boto3_mock = MagicMock()
        boto3_mock.client.side_effect = lambda svc: {
            "ssm": ssm,
            "ecs": ecs,
            "rds": rds,
        }[svc]

        with patch.dict(os.environ, BASE_ENV, clear=True):
            with patch("boto3.client", boto3_mock.client):
                # Must re-import after patching boto3 at module level
                sys.modules.pop("index", None)
                import importlib.util, pathlib
                spec = importlib.util.spec_from_file_location(
                    "index",
                    pathlib.Path(__file__).parent.parent / "index.py",
                )
                mod = importlib.util.module_from_spec(spec)
                # Patch boto3 inside the module namespace
                mod.boto3 = boto3_mock  # type: ignore[attr-defined]
                spec.loader.exec_module(mod)  # type: ignore[union-attr]
                return mod.handler(_post_event(), None)

    # ------------------------------------------------------------------
    # Test 1 (RED → GREEN): both update_service calls are made
    # ------------------------------------------------------------------

    def test_both_ecs_update_service_calls_made(self):
        ssm = _make_ssm_client()
        ecs = _make_ecs_client()
        rds = _make_rds_client(status="available")

        resp = self._run_handler(ssm, ecs, rds)

        self.assertEqual(resp["statusCode"], 200)

        update_calls = ecs.update_service.call_args_list
        self.assertEqual(len(update_calls), 2, "Expected exactly 2 update_service calls")

        clusters = {c.kwargs.get("cluster") or c.args[0] for c in update_calls}
        services = {
            c.kwargs.get("service") if "service" in c.kwargs else c.args[1]
            for c in update_calls
        }

        # Both calls target the same cluster
        self.assertIn("my-cluster", clusters)

        # One call per service
        self.assertIn("backend-svc", services)
        self.assertIn("mcp-svc", services)

        # Both with desiredCount=1
        for c in update_calls:
            desired = c.kwargs.get("desiredCount") if "desiredCount" in c.kwargs else c.args[2]
            self.assertEqual(desired, 1)

    # ------------------------------------------------------------------
    # Test 2 (RED → GREEN): MCP error does not prevent backend call
    # ------------------------------------------------------------------

    def test_mcp_ecs_error_does_not_prevent_backend_update(self):
        ssm = _make_ssm_client()
        rds = _make_rds_client(status="available")
        ecs = _make_ecs_client()

        call_order = []

        def update_service_side_effect(**kwargs):
            svc = kwargs.get("service")
            call_order.append(svc)
            if svc == "mcp-svc":
                raise Exception("MCP ECS error")
            return {}

        ecs.update_service.side_effect = update_service_side_effect

        resp = self._run_handler(ssm, ecs, rds)

        self.assertEqual(resp["statusCode"], 200)
        # backend call must have been attempted regardless of MCP error
        self.assertIn("backend-svc", call_order)
        self.assertIn("mcp-svc", call_order)

    # ------------------------------------------------------------------
    # Test 3: backend error does not prevent MCP call
    # ------------------------------------------------------------------

    def test_backend_ecs_error_does_not_prevent_mcp_update(self):
        ssm = _make_ssm_client()
        rds = _make_rds_client(status="available")
        ecs = _make_ecs_client()

        call_order = []

        def update_service_side_effect(**kwargs):
            svc = kwargs.get("service")
            call_order.append(svc)
            if svc == "backend-svc":
                raise Exception("Backend ECS error")
            return {}

        ecs.update_service.side_effect = update_service_side_effect

        resp = self._run_handler(ssm, ecs, rds)

        self.assertEqual(resp["statusCode"], 200)
        self.assertIn("backend-svc", call_order)
        self.assertIn("mcp-svc", call_order)

    # ------------------------------------------------------------------
    # Test 4: cooldown returns early without making ECS calls
    # ------------------------------------------------------------------

    def test_cooldown_skips_ecs_calls(self):
        ssm = _make_ssm_client(on_cooldown=True)
        ecs = _make_ecs_client()
        rds = _make_rds_client()

        resp = self._run_handler(ssm, ecs, rds)

        self.assertEqual(resp["statusCode"], 202)
        ecs.update_service.assert_not_called()


if __name__ == "__main__":
    unittest.main()
