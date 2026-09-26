"""
User resolution for the two auth modes (docs/adr/0006-auth-modes.md).

- ``none`` mode: one implicit local user owns everything.
- ``oidc`` mode: users are keyed on (provider, OIDC ``sub``), never on email.
  Email is mutable at many providers, so linking accounts by email would let
  anyone who can set an arbitrary email at their provider take over the
  matching FastSpec account.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from config import Settings
from models import APIKey, LintRuleset, OpenAPISpec, SpecVersion, User

LOCAL_PROVIDER = "local"
LOCAL_SUBJECT = "local"
LOCAL_EMAIL = "local@localhost"


class SignInRejected(Exception):
    """Sign-in refused for a reason that is safe to show the user."""


def get_or_create_local_user(db: Session) -> User:
    user = (
        db.query(User)
        .filter(User.provider == LOCAL_PROVIDER, User.provider_user_id == LOCAL_SUBJECT)
        .first()
    )
    if user is None:
        user = User(
            email=LOCAL_EMAIL,
            name="Local user",
            provider=LOCAL_PROVIDER,
            provider_user_id=LOCAL_SUBJECT,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def email_allowed(email: str, email_verified: object, settings: Settings) -> bool:
    """True when no allowlist is configured, or the verified email matches it."""
    emails = settings.allowed_emails_list
    domains = settings.allowed_email_domains_list
    if not emails and not domains:
        return True
    # An allowlist is only meaningful for addresses the provider vouches for.
    if email_verified is not True:
        return False
    email = email.lower()
    return email in emails or email.rsplit("@", 1)[-1] in domains


def upsert_oidc_user(db: Session, provider: str, claims: dict, settings: Settings) -> User:
    subject = claims.get("sub")
    email = claims.get("email")
    if not subject or not email:
        raise SignInRejected("Your identity provider did not share an email address.")
    if claims.get("email_verified") is False:
        raise SignInRejected("Your email address is not verified with your identity provider.")
    if not email_allowed(email, claims.get("email_verified"), settings):
        raise SignInRejected("This account is not allowed to sign in to this FastSpec instance.")

    user = (
        db.query(User)
        .filter(User.provider == provider, User.provider_user_id == subject)
        .first()
    )
    email_owner = (
        db.query(User).filter(User.provider == provider, User.email == email).first()
    )

    if user is None:
        if email_owner is not None:
            raise SignInRejected(
                "An account with this email already exists for a different "
                "identity. Contact the administrator of this FastSpec instance."
            )
        user = User(email=email, provider=provider, provider_user_id=subject)
        db.add(user)
    elif email_owner is None:
        # The provider reports a new address for the same identity.
        user.email = email

    user.name = claims.get("name") or user.name
    user.avatar_url = claims.get("picture") or user.avatar_url
    db.commit()
    db.refresh(user)
    return user


@dataclass
class TransferResult:
    specs: int
    rulesets: int
    revoked_api_keys: int


def transfer_local_data(db: Session, to_email: str) -> TransferResult:
    """Move everything the single-user ``none``-mode account owns to a real
    account, for instances that start solo and later switch to OIDC.

    The target must have signed in at least once so their account exists.
    The local user's API keys are revoked rather than moved: they were
    issued for a server without sign-in.
    """
    local = (
        db.query(User)
        .filter(User.provider == LOCAL_PROVIDER, User.provider_user_id == LOCAL_SUBJECT)
        .first()
    )
    if local is None:
        raise ValueError("No local user found — nothing to transfer.")

    targets = (
        db.query(User)
        .filter(User.email == to_email, User.provider != LOCAL_PROVIDER)
        .all()
    )
    if not targets:
        raise ValueError(f"No account for {to_email}. Sign in once with that account first.")
    if len(targets) > 1:
        raise ValueError(f"Several accounts use {to_email}; cannot pick one.")
    target = targets[0]

    specs = db.query(OpenAPISpec).filter(OpenAPISpec.user_id == local.id).all()
    for spec in specs:
        spec.user_id = target.id
    db.query(SpecVersion).filter(SpecVersion.created_by == local.id).update(
        {SpecVersion.created_by: target.id}, synchronize_session=False
    )

    target_names = {
        name for (name,) in db.query(LintRuleset.name).filter(LintRuleset.user_id == target.id)
    }
    target_has_default = (
        db.query(LintRuleset)
        .filter(LintRuleset.user_id == target.id, LintRuleset.is_default.is_(True))
        .first()
        is not None
    )
    rulesets = db.query(LintRuleset).filter(LintRuleset.user_id == local.id).all()
    for ruleset in rulesets:
        if ruleset.name in target_names:
            ruleset.name = f"{ruleset.name} (local)"
        if target_has_default:
            ruleset.is_default = False
        ruleset.user_id = target.id

    keys = (
        db.query(APIKey)
        .filter(APIKey.user_id == local.id, APIKey.revoked.is_(False))
        .all()
    )
    for key in keys:
        key.revoked = True

    db.commit()
    return TransferResult(specs=len(specs), rulesets=len(rulesets), revoked_api_keys=len(keys))
