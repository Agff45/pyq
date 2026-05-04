<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleLogin">
      <div class="login-header">
        <div class="login-avatar">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="var(--theme-color)">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        </div>
        <h1>Amigo 管理后台</h1>
        <p>发一条新动态吧</p>
      </div>

      <div class="login-fields">
        <div class="field">
          <input
            v-model="form.username"
            type="text"
            placeholder="用户名"
            autocomplete="username"
            required
          />
        </div>
        <div class="field">
          <input
            v-model="form.password"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            required
          />
        </div>
      </div>

      <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>

      <button type="submit" class="login-btn" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({ username: '', password: '' });
const loading = ref(false);
const errorMsg = ref('');

async function handleLogin() {
  errorMsg.value = '';
  loading.value = true;
  try {
    await authStore.loginAction(form.username, form.password);
    router.push('/editor');
  } catch (err) {
    errorMsg.value = err.response?.data?.message || '登录失败，请重试';
  } finally {
    loading.value = false;
  }
}
</script>
