<template>
  <div class="page-placeholder">
    <header class="editor-topbar">
      <button class="back-btn" @click="$router.push('/editor')"><span>←</span> 返回</button>
      <h2>媒体库</h2>
      <button class="logout-btn" @click="handleLogout">退出</button>
    </header>
    <main class="list-main">
      <p class="empty-msg">媒体库功能开发中...</p>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
function handleLogout() { authStore.logout(); router.push('/login'); }
</script>
