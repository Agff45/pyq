<template>
  <div class="list-page">
    <header class="editor-topbar">
      <h2>文章管理</h2>
      <div class="topbar-actions">
        <button class="new-post-btn" @click="$router.push('/editor')">+ 发新动态</button>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="list-main">
      <div class="list-search-bar">
        <input v-model="search" type="text" placeholder="搜索文章标题..." @input="debouncedSearch" />
        <span style="font-size:13px;color:var(--text-muted)">共 {{ total }} 篇</span>
      </div>

      <div v-if="loading" class="empty-msg">加载中...</div>

      <div v-else-if="posts.length === 0" class="empty-msg">
        暂无文章，快去<a href="#" @click.prevent="$router.push('/editor')" style="color:var(--text-link)">发一条动态</a>吧
      </div>

      <template v-else>
        <div
          v-for="post in posts"
          :key="post.filename"
          class="post-item"
          @click="$router.push(`/editor/${encodeURIComponent(post.filename)}`)"
        >
          <div class="post-item-main">
            <div class="post-item-title">
              <span v-if="post.weight > 0" style="color:var(--theme-color);margin-right:4px;">📌</span>
              {{ post.title || '(无标题)' }}
            </div>
            <div class="post-item-meta">
              <span>{{ formatDate(post.date) }}</span>
              <span v-if="post.location">· {{ post.location }}</span>
              <span v-if="post.isLongArticle">· 长文章</span>
              <span v-if="post.imageCount">· {{ post.imageCount }} 图</span>
              <span v-if="post.draft" class="post-item-draft-tag">草稿</span>
              <span v-for="tag in post.tags" :key="tag" class="post-item-tag">#{{ tag }}</span>
            </div>
          </div>
          <div class="post-item-actions" @click.stop>
            <button @click.stop="handleTogglePin(post)" :class="{ 'btn-pin': post.weight > 0 }">
              {{ post.weight > 0 ? '取消置顶' : '置顶' }}
            </button>
            <button @click.stop="handleDelete(post)" class="btn-delete">删除</button>
          </div>
        </div>

        <div v-if="totalPages > 1" class="list-pagination">
          <button :disabled="page <= 1" @click="page--; fetchPosts()">上一页</button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages" @click="page++; fetchPosts()">下一页</button>
        </div>
      </template>
    </main>

    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getPosts, deletePost, togglePin } from '@/api/posts';

const router = useRouter();
const authStore = useAuthStore();

const posts = ref([]);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);
const toastMsg = ref('');
const toastType = ref('success');

let searchTimer = null;

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    fetchPosts();
  }, 400);
}

async function fetchPosts() {
  loading.value = true;
  try {
    const res = await getPosts({
      page: page.value,
      limit: 20,
      search: search.value || undefined,
    });
    const d = res.data.data;
    posts.value = d.items;
    total.value = d.total;
    totalPages.value = d.totalPages;
  } catch (err) {
    showToast('加载失败', 'error');
  } finally {
    loading.value = false;
  }
}

async function handleTogglePin(post) {
  try {
    const res = await togglePin(post.filename);
    post.weight = res.data.data.weight;
    showToast(res.data.message, 'success');
    fetchPosts();
  } catch {
    showToast('操作失败', 'error');
  }
}

async function handleDelete(post) {
  if (!confirm(`确定要删除"${post.title}"吗？此操作不可撤销。`)) return;
  try {
    await deletePost(post.filename);
    showToast('已删除', 'success');
    fetchPosts();
  } catch {
    showToast('删除失败', 'error');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function showToast(msg, type = 'success') {
  toastMsg.value = msg;
  toastType.value = type;
  setTimeout(() => { toastMsg.value = ''; }, 2500);
}

onMounted(fetchPosts);
</script>
