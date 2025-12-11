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
)

# GitHub OAuth Configuration
oauth.register(
    name="github",
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    access_token_url="https://github.com/login/oauth/access_token",
    access_token_params=None,
    authorize_url="https://github.com/login/oauth/authorize",
    authorize_params=None,
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
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


async def get_github_user_info(token: dict) -> dict:
    """
    Extract user information from GitHub OAuth token

    Args:
        token: OAuth token response from GitHub

    Returns:
        Dict with user information (email, name, avatar_url, provider_user_id)
    """
    # GitHub requires separate API calls for user info
    import httpx

    access_token = token.get("access_token")
    headers = {
        "Authorization": f"token {access_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient() as client:
        # Get user profile
        user_response = await client.get("https://api.github.com/user", headers=headers)
        user_data = user_response.json()

        # Get user emails if email is not public
        email = user_data.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails", headers=headers
            )
            emails_data = emails_response.json()
            # Get primary email
            for email_obj in emails_data:
                if email_obj.get("primary"):
                    email = email_obj.get("email")
                    break

        return {
            "email": email,
            "name": user_data.get("name") or user_data.get("login"),
            "avatar_url": user_data.get("avatar_url"),
            "provider_user_id": str(user_data.get("id")),
        }
