"""
OAuth2 provider configuration and utilities
"""

import os
from authlib.integrations.starlette_client import OAuth

# Initialize OAuth registry
oauth = OAuth()

# Google OAuth Configuration
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile",
        "prompt": "select_account",
    },
    check_state=False,  # Disable state check for development
)


async def get_google_user_info(token: dict) -> dict:
    """
    Extract user information from Google OAuth token

    Args:
        token: OAuth token response from Google

    Returns:
        Dict with user information (email, name, avatar_url, provider_user_id)
    """
    user_info = token.get("userinfo", {})
    return {
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "avatar_url": user_info.get("picture"),
        "provider_user_id": user_info.get("sub"),
    }



