"""
Tell the operator when someone signs in for the first time.

Publishes to the SNS topic in SIGNUP_TOPIC_ARN, which the AWS deployment
creates (infra/lib/lambda-stack.ts); subscribe an email address to it to get
the messages. Unset — the default, and every self-hosted instance — means
nothing is sent.

A notification is a courtesy, never part of signing in: any failure is
logged and swallowed, and the SNS client gives up within seconds rather than
hold the sign-in redirect.
"""

import logging
from datetime import UTC, datetime
from functools import lru_cache

from config import Settings
from models import User

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _sns_client():
    # boto3 ships in the Lambda image only (requirements-lambda.in).
    import boto3
    from botocore.config import Config

    return boto3.client(
        "sns",
        config=Config(connect_timeout=2, read_timeout=2, retries={"max_attempts": 1}),
    )


def new_user_message(user: User) -> tuple[str, str]:
    """Subject and body for a first sign-in."""
    subject = "FastSpec: new user signed in"
    body = "\n".join(
        [
            "Someone signed in to FastSpec for the first time.",
            "",
            f"Email:    {user.email}",
            f"Name:     {user.name or '-'}",
            f"Provider: {user.provider}",
            f"When:     {datetime.now(UTC):%Y-%m-%d %H:%M} UTC",
        ]
    )
    return subject, body


def notify_new_user(user: User, settings: Settings) -> None:
    if not settings.signup_topic_arn:
        return
    subject, body = new_user_message(user)
    try:
        _sns_client().publish(TopicArn=settings.signup_topic_arn, Subject=subject, Message=body)
    except Exception:
        logger.exception("Could not send the new-user notification")
