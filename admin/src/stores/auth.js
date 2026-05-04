import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as loginApi, verifyToken } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const username = ref('');
  const isAuthenticated = ref(false);

  async function checkAuth() {
    if (!token.value) return false;
    try {
      const res = await verifyToken();
      username.value = res.data.data.username;
      isAuthenticated.value = true;
      return true;
    } catch {
      logout();
      return false;
    }
  }

  async function loginAction(user, pass) {
    const res = await loginApi(user, pass);
    const data = res.data.data;
    token.value = data.token;
    username.value = data.username;
    isAuthenticated.value = true;
    localStorage.setItem('token', data.token);
    return data;
  }

  function logout() {
    token.value = '';
    username.value = '';
    isAuthenticated.value = false;
    localStorage.removeItem('token');
  }

  return { token, username, isAuthenticated, checkAuth, loginAction, logout };
});
