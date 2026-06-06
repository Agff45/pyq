<template>
  <button class="admin-theme-toggle" type="button" :title="isDark ? '切换亮色模式' : '切换暗色模式'" @click="toggleTheme">
    <span v-if="isDark">☀</span>
    <span v-else>☾</span>
  </button>
  <router-view />
</template>

<script setup>
import { onMounted, ref } from 'vue';

const isDark = ref(false);

function applyTheme(dark) {
  isDark.value = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('admin-theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

onMounted(() => {
  const saved = localStorage.getItem('admin-theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ? saved === 'dark' : prefersDark);
});
</script>
