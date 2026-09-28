"""
Unit tests for the wake Lambda handler.

Same structure as infra/lambda/auto-stop/tests/test_handler.py: the module is
imported fresh per test (via importlib, from a file path) with boto3
patched, so module-level state (the cached secret) never leaks between tests.
"""
import importlib.util
import json
import os
import pathlib
import time
import unittest
from unittest.mock import MagicMock, patch

BASE_ENV = {
    "ENV": "dev",
    "RDS_INSTANCE_ID": "my-rds",
}


def _event(method="POST", secret="test-secret"):
    return {
        "requestContext": {"http": {"method": method}},
        "body": json.dumps({"secret": secret}),
    }


def _make_ssm_client(secret="test-secret", last_triggered=None):
    ssm = MagicMock()

    def get_parameter(Name, **kwargs):
        if "wake-secret" in Name:
            return {"Parameter": {"Value": secret}}
        return {"Parameter": {"Value": str(last_triggered or time.time())}}

    ssm.get_parameter.side_effect = get_parameter
    return ssm


def _make_rds_client(status="stopped"):
    rds = MagicMock()
    rds.describe_db_instances.return_value = {
        "DBInstances": [{"DBInstanceStatus": status}]
    }
    return rds


class TestWakeHandler(unittest.TestCase):
    def _run_handler(self, ssm, rds, event=None):
        boto3_mock = MagicMock()
        boto3_mock.client.side_effect = lambda svc: {"ssm": ssm, "rds": rds}[svc]

        # `import boto3` inside exec_module rebinds the module-level name to
        # the real boto3 module, so also patch the real boto3.client.
        with (
            patch.dict(os.environ, BASE_ENV, clear=True),
            patch("boto3.client", boto3_mock.client),
        ):
            spec = importlib.util.spec_from_file_location(
                "wake_index",
                pathlib.Path(__file__).parent.parent / "index.py",
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[union-attr]
            return mod.handler(event or _event(), None)

    def test_starts_a_stopped_database(self):
        ssm, rds = _make_ssm_client(), _make_rds_client("stopped")

        resp = self._run_handler(ssm, rds)

        self.assertEqual(resp["statusCode"], 200)
        rds.start_db_instance.assert_called_once_with(DBInstanceIdentifier="my-rds")

    def test_a_recent_wake_up_or_backend_activity_does_not_prevent_starting(self):
        # The backend writes the same timestamp; it used to act as a cooldown
        # that left a stopped database stopped for an hour.
        ssm = _make_ssm_client(last_triggered=time.time() - 10)
        rds = _make_rds_client("stopped")

        self._run_handler(ssm, rds)

        rds.start_db_instance.assert_called_once()

    def test_records_the_wake_up_for_the_auto_stop(self):
        ssm, rds = _make_ssm_client(), _make_rds_client("stopped")

        self._run_handler(ssm, rds)

        name = ssm.put_parameter.call_args.kwargs["Name"]
        self.assertEqual(name, "/dev/fastspec/wake-last-triggered")

    def test_leaves_a_database_that_is_not_stopped_alone(self):
        for status in ("available", "starting", "stopping"):
            with self.subTest(status=status):
                rds = _make_rds_client(status)

                resp = self._run_handler(_make_ssm_client(), rds)

                self.assertEqual(resp["statusCode"], 202)
                self.assertEqual(json.loads(resp["body"]), {"status": status})
                rds.start_db_instance.assert_not_called()

    def test_wrong_secret_is_rejected_before_touching_rds(self):
        rds = _make_rds_client("stopped")

        resp = self._run_handler(_make_ssm_client(), rds, _event(secret="nope"))

        self.assertEqual(resp["statusCode"], 401)
        rds.describe_db_instances.assert_not_called()

    def test_rds_failure_is_reported(self):
        rds = _make_rds_client("stopped")
        rds.start_db_instance.side_effect = Exception("InvalidDBInstanceState")

        resp = self._run_handler(_make_ssm_client(), rds)

        self.assertEqual(resp["statusCode"], 502)

    def test_preflight_and_other_methods(self):
        ssm, rds = _make_ssm_client(), _make_rds_client()
        self.assertEqual(self._run_handler(ssm, rds, _event("OPTIONS"))["statusCode"], 200)
        self.assertEqual(self._run_handler(ssm, rds, _event("GET"))["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
