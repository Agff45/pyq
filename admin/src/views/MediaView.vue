<template>
  <div class="page-placeholder">
    <header class="editor-topbar">
      <button class="back-btn" @click="$router.push('/editor')"><span>←</span> 返回</button>
      <h2>媒体库</h2>
      <div class="topbar-actions">
        <button class="logout-btn" @click="$router.push('/posts')">文章管理</button>
        <button class="logout-btn" @click="$router.push('/settings')">站点设置</button>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
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
