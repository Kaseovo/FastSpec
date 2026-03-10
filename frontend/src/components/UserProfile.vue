<template>
  <div class="user-profile">
    <Button
      class="profile-button"
      @click="toggleMenu"
      :aria-label="user?.name || 'User menu'"
    >
      <img
        v-if="user?.avatar_url"
        :src="user.avatar_url"
        :alt="user.name"
        class="avatar"
      />
      <i v-else class="pi pi-user avatar-icon"></i>
    </Button>

    <Menu ref="menu" :model="menuItems" :popup="true">
      <template #start>
        <div class="user-info">
          <img
            v-if="user?.avatar_url"
            :src="user.avatar_url"
            :alt="user.name"
            class="menu-avatar"
          />
          <div class="user-details">
            <div class="user-name">{{ user?.name || "User" }}</div>
            <div class="user-email">{{ user?.email }}</div>
            <div class="user-provider">
              <i :class="providerIcon" :style="{ color: providerColor }"></i>
              <span>{{ providerText }}</span>
            </div>
          </div>
        </div>
      </template>
    </Menu>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Menu from "primevue/menu";
import { useAuthStore } from "../stores/auth";
import { logout as apiLogout } from "../api/auth";

export default {
  name: "UserProfile",
  components: {
    Button,
    Menu,
  },
  setup() {
    const router = useRouter();
    const auth = useAuthStore();
    const user = computed(() => auth.user);
    const menu = ref();

    const providerIcon = computed(() => {
      if (user.value?.provider === "google") {
        return "pi pi-google";
      } else if (user.value?.provider === "github") {
        return "pi pi-github";
      }
      return "pi pi-user";
    });

    const providerColor = computed(() => {
      if (user.value?.provider === "google") {
        return "#4285F4";
      } else if (user.value?.provider === "github") {
        return "#24292e";
      }
      return "#6b7280";
    });

    const providerText = computed(() => {
      if (user.value?.provider === "google") {
        return "Signed in with Google";
      } else if (user.value?.provider === "github") {
        return "Signed in with GitHub";
      }
      return "Signed in";
    });

    const toggleMenu = (event) => {
      menu.value.toggle(event);
    };

    const handleLogout = async () => {
      try {
        await apiLogout();
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        auth.clearAuth();
        window.location.href = "/";
      }
    };

    const menuItems = ref([
      {
        separator: true,
      },
      {
        label: "Logout",
        icon: "pi pi-sign-out",
        command: handleLogout,
      },
    ]);

    return {
      user,
      menu,
      menuItems,
      providerIcon,
      providerColor,
      providerText,
      toggleMenu,
    };
  },
};
</script>

<style scoped>
.user-profile {
  position: relative;
}

.profile-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  background: white;
}

.profile-button:hover {
  border-color: #667eea;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-icon {
  font-size: 1.25rem;
  color: #6b7280;
}

.user-info {
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
}

.menu-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-provider {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #9ca3af;
}

.user-provider i {
  font-size: 0.875rem;
}
</style>
