import { createRouter, createWebHistory } from "vue-router";
import EditorView from "../views/EditorView.vue";
import PreviewView from "../views/PreviewView.vue";
import OAuthCallback from "../components/OAuthCallback.vue";
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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  // Allow OAuth callback regardless of auth state
  if (to.name === "oauth-callback") return true;

  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    // Redirect to the landing page (served by the landing-page container)
    window.location.href = "/";
    return false;
  }
  return true;
});

export default router;
