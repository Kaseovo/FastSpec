"""
OAuth utilities — server-side OAuth has been replaced by the Google PKCE flow.

The browser now handles Google sign-in via Google Identity Services and POSTs
the resulting id_token to POST /auth/google/verify for server-side verification.
"""
