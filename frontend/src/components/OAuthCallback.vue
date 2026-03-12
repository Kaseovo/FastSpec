<template>
  <div class="callback-page">
    <div class="callback-container">
      <ProgressSpinner v-if="!error" style="width: 50px; height: 50px" />
      <div v-if="error" class="error-state">
        <i class="pi pi-exclamation-circle"></i>
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <Button label="Try Again" @click="redirectToLogin" />
      </div>
      <div v-else class="loading-state">
        <h2>Authenticating...</h2>
        <p>Please wait while we sign you in</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import { useAuthStore } from "../stores/auth";
import { getCurrentUser } from "../api/auth";

export default {
  name: "OAuthCallback",
  components: {
    ProgressSpinner,
    Button,
  },
  setup() {
    const router = useRouter();
    const auth = useAuthStore();
    const error = ref(null);

    const redirectToLogin = () => {
      router.push({ name: "editor" }).catch(() => {});
    };

    const handleCallback = async () => {
      try {
        auth.setLoading(true);

        // Get token from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const errorParam = urlParams.get("error");

        if (errorParam) {
          error.value = errorParam;
          return;
        }

        if (!token) {
          error.value = "No authentication token received";
          return;
        }

        // Fetch user data with the token
        const user = await getCurrentUser(token);

        // Store auth data
        auth.setAuth(token, user);

        // Redirect to main app route using router
        router.push({ name: "editor" }).catch(() => {});
      } catch (err) {
        console.error("OAuth callback error:", err);
        error.value =
          err.response?.data?.detail || err.message || "Authentication failed";
      } finally {
        auth.setLoading(false);
      }
    };

    onMounted(() => {
      handleCallback();
    });

    return {
      error,
      redirectToLogin,
    };
  },
};
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.callback-container {
  background: white;
  border-radius: 16px;
  padding: 60px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  min-width: 400px;
}

.loading-state h2,
.error-state h2 {
  margin: 20px 0 10px;
  color: #1f2937;
}

.loading-state p,
.error-state p {
  color: #6b7280;
  margin-bottom: 20px;
}

.error-state i {
  font-size: 3rem;
  color: #ef4444;
}

@media (max-width: 640px) {
  .callback-container {
    min-width: auto;
    width: 90vw;
    padding: 40px 24px;
  }
}
</style>
