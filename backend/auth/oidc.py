"""
Generic OpenID Connect sign-in: Authorization Code flow with PKCE.

Works with any provider that publishes discovery metadata at
``{issuer}/.well-known/openid-configuration`` — Google, Keycloak, Authentik,
Okta, Microsoft Entra, GitLab, … See docs/adr/0006-auth-modes.md.

All outbound HTTP goes through ``http_client()`` so tests can swap in an
``httpx.MockTransport`` instead of patching individual calls.
"""

import base64
import hashlib
import secrets
import threading
import time
from dataclasses import dataclass
from urllib.parse import quote, urlencode

import httpx
import jwt

HTTP_TIMEOUT_SECONDS = 10
METADATA_TTL_SECONDS = 3600
# Tolerated clock drift between this server and the provider when checking
# iat/exp on ID tokens.
CLOCK_SKEW_SECONDS = 10


class OIDCError(Exception):
    """Sign-in failed while talking to the provider. Details are for logs only."""


def http_client() -> httpx.Client:
    return httpx.Client(timeout=HTTP_TIMEOUT_SECONDS)


def new_code_verifier() -> str:
    return secrets.token_urlsafe(48)


def code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


@dataclass(frozen=True)
class ProviderMetadata:
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    token_endpoint_auth_methods: tuple[str, ...]
    signing_algs: tuple[str, ...]


class OIDCClient:
    def __init__(
        self,
        issuer: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: str = "openid email profile",
    ):
        self.issuer = issuer.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self._lock = threading.Lock()
        self._metadata: ProviderMetadata | None = None
        self._metadata_fetched_at = 0.0
        self._jwks: dict[str, jwt.PyJWK] = {}

    # ── Discovery ────────────────────────────────────────────────────────────

    def metadata(self) -> ProviderMetadata:
        with self._lock:
            fresh = time.monotonic() - self._metadata_fetched_at < METADATA_TTL_SECONDS
            if self._metadata is None or not fresh:
                self._metadata = self._fetch_metadata()
                self._metadata_fetched_at = time.monotonic()
            return self._metadata

    def _fetch_metadata(self) -> ProviderMetadata:
        url = f"{self.issuer}/.well-known/openid-configuration"
        doc = self._get_json(url)
        try:
            metadata = ProviderMetadata(
                # Exactly as published: ID tokens must carry this exact `iss`
                # (some providers, e.g. Authentik, end it with a slash).
                issuer=doc["issuer"],
                authorization_endpoint=doc["authorization_endpoint"],
                token_endpoint=doc["token_endpoint"],
                jwks_uri=doc["jwks_uri"],
                # Spec default when the provider doesn't say: client_secret_basic.
                token_endpoint_auth_methods=tuple(
                    doc.get("token_endpoint_auth_methods_supported")
                    or ["client_secret_basic"]
                ),
                signing_algs=tuple(
                    doc.get("id_token_signing_alg_values_supported") or ["RS256"]
                ),
            )
        except (KeyError, AttributeError, TypeError) as exc:
            raise OIDCError(f"Incomplete discovery document at {url}") from exc
        if metadata.issuer.rstrip("/") != self.issuer:
            raise OIDCError(
                f"Discovery issuer {metadata.issuer!r} does not match "
                f"configured OIDC_ISSUER {self.issuer!r}"
            )
        return metadata

    # ── Authorization request ────────────────────────────────────────────────

    def authorization_url(self, state: str, nonce: str, code_verifier: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": self.scopes,
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge(code_verifier),
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
        return f"{self.metadata().authorization_endpoint}?{urlencode(params)}"

    # ── Token exchange ───────────────────────────────────────────────────────

    def exchange_code(self, code: str, code_verifier: str) -> str:
        """Exchange an authorization code for the provider's ID token."""
        metadata = self.metadata()
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "code_verifier": code_verifier,
        }
        auth = None
        if "client_secret_basic" in metadata.token_endpoint_auth_methods:
            # RFC 6749 §2.3.1: credentials are form-encoded before Basic auth.
            auth = (quote(self.client_id, safe=""), quote(self.client_secret, safe=""))
        else:
            data["client_id"] = self.client_id
            data["client_secret"] = self.client_secret

        try:
            with http_client() as http:
                resp = http.post(metadata.token_endpoint, data=data, auth=auth)
        except httpx.HTTPError as exc:
            raise OIDCError(f"Token endpoint unreachable: {exc}") from exc
        if resp.status_code >= 400:
            raise OIDCError(f"Token endpoint returned {resp.status_code}: {resp.text[:500]}")
        id_token = resp.json().get("id_token")
        if not id_token:
            raise OIDCError("Token response has no id_token")
        return id_token

    # ── ID token verification ────────────────────────────────────────────────

    def verify_id_token(self, id_token: str, nonce: str) -> dict:
        metadata = self.metadata()
        try:
            header = jwt.get_unverified_header(id_token)
        except jwt.PyJWTError as exc:
            raise OIDCError(f"Malformed ID token: {exc}") from exc

        alg = header.get("alg")
        # Only asymmetric algorithms the provider advertises. Rejecting HS*
        # and "none" rules out algorithm-confusion attacks.
        if not alg or alg == "none" or alg.startswith("HS") or alg not in metadata.signing_algs:
            raise OIDCError(f"Unsupported ID token algorithm: {alg!r}")

        key = self._signing_key(header.get("kid"))
        try:
            claims = jwt.decode(
                id_token,
                key=key.key,
                algorithms=[alg],
                audience=self.client_id,
                issuer=metadata.issuer,
                leeway=CLOCK_SKEW_SECONDS,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise OIDCError(f"Invalid ID token: {exc}") from exc

        if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
            raise OIDCError("ID token nonce mismatch")
        return claims

    def _signing_key(self, kid: str | None) -> jwt.PyJWK:
        key = self._lookup_key(kid)
        if key is None:
            # Unknown kid: the provider may have rotated keys — refetch once.
            self._refresh_jwks()
            key = self._lookup_key(kid)
        if key is None:
            raise OIDCError(f"No signing key found for kid {kid!r}")
        return key

    def _lookup_key(self, kid: str | None) -> jwt.PyJWK | None:
        if kid is not None:
            return self._jwks.get(kid)
        # No kid in the header: only unambiguous when the set has one key.
        return next(iter(self._jwks.values())) if len(self._jwks) == 1 else None

    def _refresh_jwks(self) -> None:
        doc = self._get_json(self.metadata().jwks_uri)
        keys: dict[str, jwt.PyJWK] = {}
        for jwk in doc.get("keys", []):
            if jwk.get("use", "sig") != "sig":
                continue
            try:
                parsed = jwt.PyJWK(jwk)
            except jwt.PyJWTError:
                continue  # key type we can't use (e.g. an encryption key)
            keys[jwk.get("kid") or f"_anonymous{len(keys)}"] = parsed
        self._jwks = keys

    # ── HTTP ─────────────────────────────────────────────────────────────────

    def _get_json(self, url: str) -> dict:
        try:
            with http_client() as http:
                resp = http.get(url)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OIDCError(f"Could not fetch {url}: {exc}") from exc
