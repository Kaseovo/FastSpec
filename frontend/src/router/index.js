import { createRouter, createWebHistory } from "vue-router";
import EditorView from "../views/EditorView.vue";
import PreviewView from "../views/PreviewView.vue";
import OAuthCallback from "../components/OAuthCallback.vue";

const routes = [
  { path: "/", redirect: "/specs" },
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

export default router;
