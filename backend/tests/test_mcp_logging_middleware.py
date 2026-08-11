"""
LoggingMiddleware must not leak MCP tool input/output (spec content, user
data) into logs -- it previously did via bare print() of the full message
content and result. Verifies: nothing goes to stdout, and the log records
it does emit carry only method/tool-name metadata, never the actual
sensitive payload.
"""

import logging
from types import SimpleNamespace

import pytest

from fastmcp_server.middleware import LoggingMiddleware

SENSITIVE_INPUT = "sk_live_super_secret_api_key_payload"
SENSITIVE_OUTPUT = {"openapi": "3.0.0", "info": {"title": "Someone's Private Spec"}}


@pytest.fixture
def anyio_backend():
    return "asyncio"  # trio isn't a project dependency


def _make_context(method="tools/call", name="get_spec_details", content=SENSITIVE_INPUT):
    message = SimpleNamespace(name=name, content=content)
    return SimpleNamespace(method=method, message=message)


@pytest.mark.anyio
async def test_on_message_does_not_print_sensitive_content(capsys):
    middleware = LoggingMiddleware()
    context = _make_context()

    async def call_next(_ctx):
        return SENSITIVE_OUTPUT

    result = await middleware.on_message(context, call_next)

    assert result == SENSITIVE_OUTPUT
    captured = capsys.readouterr()
    assert captured.out == ""  # no print() output at all anymore


@pytest.mark.anyio
async def test_on_message_logs_only_method_and_tool_name(caplog):
    middleware = LoggingMiddleware()
    context = _make_context()

    async def call_next(_ctx):
        return SENSITIVE_OUTPUT

    with caplog.at_level(logging.INFO, logger="fastmcp_server.middleware"):
        await middleware.on_message(context, call_next)

    assert caplog.records, "expected LoggingMiddleware to emit log records"
    for record in caplog.records:
        message = record.getMessage()
        assert SENSITIVE_INPUT not in message
        assert "Private Spec" not in message
        assert "openapi" not in message
    joined = " ".join(r.getMessage() for r in caplog.records)
    assert context.method in joined
    assert context.message.name in joined


@pytest.mark.anyio
async def test_on_message_logs_failure_without_leaking_and_reraises(caplog):
    middleware = LoggingMiddleware()
    context = _make_context()

    async def call_next(_ctx):
        raise RuntimeError(f"boom while processing {SENSITIVE_INPUT}")

    with caplog.at_level(logging.INFO, logger="fastmcp_server.middleware"):
        with pytest.raises(RuntimeError):
            await middleware.on_message(context, call_next)

    for record in caplog.records:
        assert SENSITIVE_INPUT not in record.getMessage()
