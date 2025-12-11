# FastSpec Authentication - Quick Setup Guide

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend (in separate terminal)
cd frontend && npm install
```

### 2. Get OAuth Credentials

#### Google OAuth (2 minutes)

1. Visit: https://console.cloud.google.com/apis/credentials
2. Create OAuth client ID → Web application
3. Add redirect URI: `http://localhost:3000/auth/callback`
4. Copy Client ID and Secret

#### GitHub OAuth (2 minutes)

1. Visit: https://github.com/settings/developers
2. New OAuth App
3. Callback URL: `http://localhost:3000/auth/callback`
4. Copy Client ID and Secret

### 3. Configure Environment

Create `.env` file in project root:

```bash
# Generate a secret key first:
openssl rand -hex 32

# Then add to .env:
JWT_SECRET_KEY=<paste-the-generated-key-here>
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback
FRONTEND_URL=http://localhost:3000
```

### 4. Run Migration

```bash
python backend/migrate_add_auth.py
```

### 5. Start Application

```bash
# Option 1: Use convenience script
./start-dev.sh

# Option 2: Manual start
# Terminal 1 - Backend
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 6. Test Authentication

1. Open http://localhost:3000
2. Click "Continue with Google" or "Continue with GitHub"
3. Complete OAuth flow
4. Create your first spec! 🎉

## 📋 What Changed?

- ✅ Users must authenticate to use FastSpec
- ✅ Each user's specs are private (can't see others' specs)
- ✅ OAuth2 login with Google and GitHub
- ✅ JWT token-based authentication
- ✅ User profile with logout option

## 🔒 Security Notes

**Development:**

- Keep `.env` file private (already in `.gitignore`)
- Use any JWT secret for testing

**Production:**

- ⚠️ **Must use HTTPS** for OAuth callbacks
- Generate strong JWT secret: `openssl rand -hex 32`
- Update redirect URIs to use your domain
- Use secure database (PostgreSQL recommended)

## 🆘 Troubleshooting

**"Could not validate credentials"**
→ Check JWT_SECRET_KEY in .env matches everywhere

**OAuth callback fails**
→ Verify redirect URIs match exactly in OAuth provider settings

**CORS errors**
→ Ensure FRONTEND_URL is set correctly

**No specs showing**
→ Specs are now per-user. Each account has its own specs.

## 📚 Full Documentation

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for complete documentation including:

- Detailed setup instructions
- Architecture overview
- Security best practices
- API endpoints
- Troubleshooting guide

## 🚀 Production Deployment

When deploying to production:

1. Update OAuth redirect URIs to your domain
2. Set strong JWT secret
3. Use PostgreSQL/MySQL instead of SQLite
4. Enable HTTPS
5. Restrict CORS origins

Example production `.env`:

```bash
JWT_SECRET_KEY=<strong-random-key>
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
GITHUB_REDIRECT_URI=https://yourdomain.com/auth/callback
FRONTEND_URL=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host/db
CORS_ORIGINS=https://yourdomain.com
```

## 📝 Migration from Old Version

If you have existing specs before authentication:

1. Run migration script (step 4 above)
2. Existing specs are assigned to a "system" user
3. They won't be visible to regular users
4. Admin can reassign if needed

## ✨ Features

- **Private Specifications**: Your specs are only visible to you
- **OAuth Login**: No passwords to remember
- **Secure**: JWT tokens with configurable expiration
- **User Profiles**: See your account info and logout
- **Same Great Editor**: All existing features work the same

---

Need help? Check the [full authentication documentation](docs/AUTHENTICATION.md)
