# FastSpec Authentication Setup Guide

## Overview

FastSpec now includes OAuth2 authentication with Google and GitHub providers. This allows users to securely sign in and manage their own private OpenAPI specifications.

## Features

- **OAuth2 Social Login**: Sign in with Google or GitHub
- **JWT Token Authentication**: Secure session management
- **Private Specifications**: Each user can only see and edit their own specs
- **User Profile Management**: View account information and logout

## Quick Start

### 1. Install Dependencies

#### Backend

```bash
cd backend
pip install -r requirements.txt
```

#### Frontend

```bash
cd frontend
npm install
```

### 2. Set Up OAuth Credentials

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URIs:
     - Development: `http://localhost:3000/auth/callback`
     - Production: `https://yourdomain.com/auth/callback`
5. Copy the Client ID and Client Secret

#### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: FastSpec
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/auth/callback`
4. Click "Register application"
5. Copy the Client ID
6. Generate a new Client Secret and copy it

### 3. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production-use-openssl-rand-hex-32
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=43200  # 30 days

# OAuth2 - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# OAuth2 - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=sqlite:///./fastspec.db

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Important**: Generate a strong JWT secret key:

```bash
openssl rand -hex 32
```

### 4. Run Database Migration

```bash
cd backend
python migrate_add_auth.py
```

This will:

- Create the `users` table
- Add `user_id` column to `openapi_specs` table
- Create a system user for any existing specs

### 5. Start the Application

#### Development Mode

```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Or use the convenience script:

```bash
./start-dev.sh
```

#### Production Mode

```bash
./start.sh
```

## Architecture

### Authentication Flow

```
┌──────┐         ┌──────────┐         ┌─────────┐         ┌──────────┐
│ User │────────>│ Frontend │────────>│ Backend │────────>│  OAuth   │
└──────┘         └──────────┘         └─────────┘         │ Provider │
   │                   │                    │              └──────────┘
   │                   │                    │                    │
   │                   │                    │<───────────────────┘
   │                   │                    │   (user info)
   │                   │<───────────────────┘
   │                   │   (JWT token)
   │<──────────────────┘
   │   (redirect to app)
```

### Components

#### Backend

- **Models** (`backend/models.py`):

  - `User`: Stores user information from OAuth providers
  - `OpenAPISpec`: Updated with `user_id` foreign key

- **Authentication** (`backend/auth/`):

  - `jwt.py`: JWT token creation and verification
  - `oauth.py`: OAuth provider configuration
  - `dependencies.py`: FastAPI authentication dependencies

- **Routes** (`backend/routers/`):
  - `auth.py`: OAuth and JWT endpoints
  - `specs.py`: Protected specification endpoints

#### Frontend

- **Store** (`frontend/src/stores/auth.js`):

  - Manages authentication state
  - Stores JWT token and user data

- **Components**:

  - `LoginPage.vue`: OAuth login buttons
  - `OAuthCallback.vue`: Handles OAuth redirect
  - `UserProfile.vue`: User profile dropdown

- **API** (`frontend/src/api/`):
  - `auth.js`: Authentication API calls
  - `specs.js`: Updated with JWT interceptors

## API Endpoints

### Authentication Endpoints

| Method | Endpoint                | Description                  |
| ------ | ----------------------- | ---------------------------- |
| GET    | `/auth/google`          | Initiate Google OAuth flow   |
| GET    | `/auth/google/callback` | Handle Google OAuth callback |
| GET    | `/auth/github`          | Initiate GitHub OAuth flow   |
| GET    | `/auth/github/callback` | Handle GitHub OAuth callback |
| GET    | `/auth/me`              | Get current user information |
| POST   | `/auth/logout`          | Logout (client-side)         |

### Protected Specification Endpoints

All `/api/specs/*` endpoints now require authentication via `Authorization: Bearer <token>` header.

## Security Considerations

### Development

- Use `http://localhost:3000` for testing
- Keep OAuth secrets in `.env` file (never commit)
- JWT secret can be simple for development

### Production

1. **HTTPS Required**: OAuth providers require HTTPS in production

   ```bash
   # Update redirect URIs in OAuth provider settings
   GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
   GITHUB_REDIRECT_URI=https://yourdomain.com/auth/callback
   ```

2. **Strong JWT Secret**: Generate a secure random key

   ```bash
   openssl rand -hex 32
   ```

3. **Secure Database**: Use PostgreSQL or MySQL instead of SQLite

   ```bash
   DATABASE_URL=postgresql://user:password@localhost/fastspec
   ```

4. **CORS Configuration**: Restrict allowed origins

   ```bash
   CORS_ORIGINS=https://yourdomain.com
   ```

5. **Environment Variables**: Use a secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)

6. **Token Expiration**: Consider shorter expiration times for sensitive data
   ```bash
   JWT_EXPIRATION_MINUTES=1440  # 24 hours
   ```

## Troubleshooting

### "Could not validate credentials" Error

- Check that JWT_SECRET_KEY matches between token creation and verification
- Verify the token hasn't expired
- Ensure the user still exists in the database

### OAuth Callback Fails

- Verify redirect URIs match exactly in OAuth provider settings
- Check that OAuth credentials are correct in `.env`
- Ensure the backend is running and accessible

### "User not found" After Login

- Check database migration completed successfully
- Verify user was created in the database after OAuth flow

### CORS Errors

- Ensure CORS_ORIGINS includes your frontend URL
- Check that credentials are allowed in CORS settings

## User Flow

1. User visits FastSpec
2. Sees login page with Google/GitHub buttons
3. Clicks provider button
4. Redirects to OAuth provider
5. User grants permission
6. Provider redirects back with authorization code
7. Backend exchanges code for user info
8. Backend creates/updates user in database
9. Backend generates JWT token
10. Frontend stores token and user data
11. User sees main application
12. All API requests include JWT token

## Data Migration

If you have existing specs before adding authentication:

1. The migration script creates a "system" user
2. All existing specs are assigned to this user
3. Real users can't see these specs
4. Admin can manually reassign specs if needed

## Testing

### Manual Testing

1. Start both backend and frontend
2. Navigate to `http://localhost:3000`
3. Click "Continue with Google" or "Continue with GitHub"
4. Complete OAuth flow
5. Verify you're logged in (see profile in header)
6. Create/edit specs
7. Logout and verify you're redirected to login
8. Login again and verify your specs are still there

### API Testing with curl

```bash
# Get JWT token (after OAuth login, from browser localStorage)
TOKEN="your-jwt-token"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/specs

# Test user info
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/me
```

## Support

For issues or questions:

1. Check this documentation
2. Review the [implementation plan](../plans/authentication-implementation-plan.md)
3. Check backend logs for errors
4. Verify all environment variables are set correctly
