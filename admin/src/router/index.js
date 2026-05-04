import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory('/admin'),
  routes: [
    {
      path: '/',
      redirect: '/editor',
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/editor',
      name: 'Editor',
      component: () => import('@/views/PostEditorView.vue'),
      meta: { requiresAuth: true, title: '发新动态' },
    },
    {
      path: '/editor/:filename',
      name: 'EditPost',
      component: () => import('@/views/PostEditorView.vue'),
      meta: { requiresAuth: true, title: '编辑动态' },
    },
    {
      path: '/posts',
      name: 'Posts',
      component: () => import('@/views/PostListView.vue'),
      meta: { requiresAuth: true, title: '文章管理' },
    },
    {
      path: '/media',
      name: 'Media',
      component: () => import('@/views/MediaView.vue'),
      meta: { requiresAuth: true, title: '媒体库' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true, title: '站点设置' },
    },
  ],
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (to.path === '/login') {
    if (token) return next('/editor');
    return next();
  }
  if (to.meta.requiresAuth && !token) {
    return next('/login');
  }
  next();
});

export default router;
