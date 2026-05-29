import { createRouter, createWebHistory } from "vue-router";
import EditorView from "../views/EditorView.vue";
import PreviewView from "../views/PreviewView.vue";
import OAuthCallback from "../components/OAuthCallback.vue";
import LoginPage from "../components/LoginPage.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  { path: "/specs", component: EditorView, name: "editor" },
  { path: "/specs/:id", component: EditorView, name: "editor-id", props: true },
  {
    path: "/specs/:id/preview",
    component: PreviewView,
    name: "preview",
    props: true,
  },
  { path: "/auth/callback", component: OAuthCallback, name: "oauth-callback" },
  { path: "/specs/login", component: LoginPage, name: "login" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  // Allow OAuth callback regardless of auth state
  if (to.name === "oauth-callback") return true;

  // Allow login page regardless of auth state
  if (to.name === "login") return true;

  // Allow navigation if a token is present in the query (will be processed by handleRootToken)
  if (to.query.token) return true;

  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    // In production, redirect to the external landing page.
    // Locally (no landing page container), fall back to the in-app login page.
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      return { name: "login" };
    }
    window.location.href = "/";
    return false;
  }
  return true;
});

export function getRouter() {
  return router;
}

export default router;
