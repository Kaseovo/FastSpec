<template>
  <div :class="inline ? 'login-inline' : 'login-page'">
    <div class="login-container">
      <div v-if="!inline" class="login-header">
        <h1>🧩 FastSpec</h1>
        <p>Create, edit, and validate OpenAPI specifications</p>
      </div>

      <div class="login-card">
        <h2>{{ inline ? "Sign in to save" : "Sign in to continue" }}</h2>
        <p class="subtitle">Choose your preferred authentication method</p>

        <div class="login-buttons">
          <button class="login-btn google-btn" @click="handleGoogleLogin">
            <svg class="provider-icon" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button class="login-btn github-btn" @click="handleGitHubLogin">
            <svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="login-footer">
          <p class="privacy-note">
            <i class="pi pi-lock"></i>
            Your data is private and secure. We only access basic profile
            information.
          </p>
        </div>
      </div>

      <div v-if="!inline" class="features">
        <div class="feature-item">
          <i class="pi pi-check-circle"></i>
          <span>Real-time validation</span>
        </div>
        <div class="feature-item">
          <i class="pi pi-check-circle"></i>
          <span>Version control</span>
        </div>
        <div class="feature-item">
          <i class="pi pi-check-circle"></i>
          <span>Swagger preview</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { loginWithGoogle, loginWithGitHub } from "../api/auth";

export default {
  name: "LoginPage",
  props: {
    inline: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const handleGoogleLogin = () => {
      loginWithGoogle();
    };

    const handleGitHubLogin = () => {
      loginWithGitHub();
    };

    return {
      handleGoogleLogin,
      handleGitHubLogin,
    };
  },
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-inline {
  padding: 0;
}

.login-inline .login-container {
  max-width: 100%;
}

.login-inline .login-card {
  box-shadow: none;
  padding: 20px;
}

.login-container {
  max-width: 480px;
  width: 100%;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
  color: white;
}

.login-header h1 {
  font-size: 3rem;
  margin-bottom: 10px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.login-header p {
  font-size: 1.1rem;
  opacity: 0.95;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-card h2 {
  margin: 0 0 10px 0;
  color: #1f2937;
  font-size: 1.75rem;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #6b7280;
  margin-bottom: 30px;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 24px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: #1f2937;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  border-color: #d1d5db;
}

.login-btn:active {
  transform: translateY(0);
}

.provider-icon {
  width: 24px;
  height: 24px;
}

.google-btn:hover {
  border-color: #4285f4;
  background: #f8faff;
}

.github-btn:hover {
  border-color: #24292e;
  background: #f6f8fa;
}

.login-footer {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.privacy-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.privacy-note i {
  color: #10b981;
}

.features {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
}

.feature-item i {
  color: #10b981;
  font-size: 1rem;
}

@media (max-width: 640px) {
  .login-card {
    padding: 30px 24px;
  }

  .login-header h1 {
    font-size: 2.5rem;
  }

  .features {
    flex-direction: column;
    align-items: center;
  }
}
</style>