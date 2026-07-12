"""
Unit tests for the auto-stop Lambda handler.

Mirrors the structure of infra/lambda/wake/tests/test_handler.py: the module
is imported fresh per test (via importlib, from a file path) with boto3
patched, so module-level state and env vars never leak between tests.
"""
import importlib.util
import pathlib
import time
import unittest
from unittest.mock import MagicMock, patch

BASE_ENV = {
    "ENV": "dev",
    "RDS_INSTANCE_ID": "my-rds",
}


def _load_handler_module(boto3_mock):
    spec = importlib.util.spec_from_file_location(
        "auto_stop_index",
        pathlib.Path(__file__).parent.parent / "index.py",
    )
    mod = importlib.util.module_from_spec(spec)
    mod.boto3 = boto3_mock  # type: ignore[attr-defined]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _make_ssm_client(last_triggered=None, raise_not_found=False):
    ssm = MagicMock()

    def get_parameter(Name, **kwargs):
        if raise_not_found:
            raise Exception("parameter not found")
        return {"Parameter": {"Value": str(last_triggered)}}

    ssm.get_parameter.side_effect = get_parameter
    return ssm


def _make_rds_client(status="available"):
    rds = MagicMock()
    rds.describe_db_instances.return_value = {
        "DBInstances": [{"DBInstanceStatus": status}]
    }
    rds.stop_db_instance = MagicMock(return_value={})
    return rds


class TestAutoStopHandler(unittest.TestCase):
    def _run_handler(self, ssm, rds):
        boto3_mock = MagicMock()
        boto3_mock.client.side_effect = lambda svc: {"ssm": ssm, "rds": rds}[svc]

        # `import boto3` inside exec_module rebinds the module-level name to
        # the *real* boto3 module, so pre-setting mod.boto3 alone isn't
        # enough — also patch the real boto3.client so calls route to our
        # fakes regardless of which boto3 object the module ends up holding.
        with patch.dict("os.environ", BASE_ENV, clear=True), \
                patch("boto3.client", boto3_mock.client):
            mod = _load_handler_module(boto3_mock)
            return mod.handler({}, None)

    def test_stops_rds_after_inactivity(self):
        ssm = _make_ssm_client(last_triggered=time.time() - 3 * 60 * 60)
        rds = _make_rds_client(status="available")

        self._run_handler(ssm, rds)

        rds.stop_db_instance.assert_called_once_with(DBInstanceIdentifier="my-rds")

    def test_skips_stop_when_recently_active(self):
        ssm = _make_ssm_client(last_triggered=time.time() - 60)
        rds = _make_rds_client(status="available")

        self._run_handler(ssm, rds)

        rds.stop_db_instance.assert_not_called()

    def test_skips_stop_when_instance_not_available(self):
        ssm = _make_ssm_client(last_triggered=time.time() - 3 * 60 * 60)
        rds = _make_rds_client(status="stopped")

        self._run_handler(ssm, rds)

        rds.stop_db_instance.assert_not_called()

    def test_returns_quietly_when_ssm_parameter_missing(self):
        ssm = _make_ssm_client(raise_not_found=True)
        rds = _make_rds_client(status="available")

        self._run_handler(ssm, rds)

        rds.describe_db_instances.assert_not_called()
        rds.stop_db_instance.assert_not_called()


if __name__ == "__main__":
    unittest.main()
