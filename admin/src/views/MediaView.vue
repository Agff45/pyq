<template>
  <div class="media-page">
    <header class="editor-topbar">
      <div class="topbar-left">
        <button class="back-btn" @click="$router.push('/editor')"><span>‹</span>返回</button>
      </div>
      <h2>媒体库</h2>
      <div class="topbar-actions">
        <button class="logout-btn" @click="$router.push('/posts')">文章</button>
        <button class="logout-btn" @click="$router.push('/settings')">设置</button>
        <span class="topbar-sep"></span>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="media-main">
      <div class="media-actions">
        <div class="media-tabs">
          <button v-for="t in tabs" :key="t.value" class="media-tab" :class="{ active: type === t.value }" @click="switchTab(t.value)">{{ t.label }}</button>
        </div>
        <button class="upload-btn" @click="triggerUpload">+ 上传文件</button>
      </div>

      <div v-if="loading" class="media-loading">加载中...</div>

      <template v-else>
        <div v-if="items.length === 0" class="media-empty">
          <p v-if="type === 'image'">还没有图片，点击右上角上传</p>
          <p v-else-if="type === 'video'">还没有视频，点击右上角上传</p>
          <p v-else-if="type === 'audio'">还没有音频，点击右上角上传</p>
          <p v-else>还没有媒体文件，点击右上角上传</p>
        </div>

        <div v-else class="media-grid">
          <div v-for="item in items" :key="item.path" class="media-card" :title="item.filename">
            <div class="media-thumb" @click="previewItem(item)">
              <img v-if="item.type === 'image'" :src="item.path" :alt="item.filename" loading="lazy" />
              <img v-else-if="item.thumb" :src="item.thumb" :alt="item.filename" loading="lazy" />
              <div v-else-if="item.type === 'video'" class="media-icon-placeholder">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
              </div>
              <div v-else-if="item.type === 'audio'" class="media-icon-placeholder">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div v-else class="media-icon-placeholder">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
              </div>
              <div v-if="item.type === 'video'" class="media-duration-badge">视频</div>
              <div v-if="item.type === 'audio'" class="media-duration-badge">音频</div>
            </div>
            <div class="media-info">
              <span class="media-name" :title="item.filename">{{ item.filename }}</span>
              <span class="media-size">{{ formatSize(item.size) }}</span>
            </div>
            <div class="media-card-actions">
              <button class="media-card-btn" title="复制路径" @click.stop="copyPath(item.path)">复制</button>
              <button class="media-card-btn danger" title="删除" @click.stop="confirmDelete(item)">删除</button>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="media-more">
          <button class="load-more-btn" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
        </div>

        <div class="media-stats" v-if="total > 0">
          共 {{ total }} 个文件，当前第 {{ page }} / {{ totalPages }} 页
        </div>
      </template>
    </main>

    <input ref="fileInput" type="file" multiple hidden @change="handleUpload" />

    <div v-if="previewVisible" class="media-preview-overlay" @click.self="previewVisible = false">
      <button class="preview-close" @click="previewVisible = false">&times;</button>
      <img v-if="previewItemData?.type === 'image'" :src="previewItemData.path" :alt="previewItemData.filename" class="preview-image" />
      <video v-else-if="previewItemData?.type === 'video'" :src="previewItemData.path" controls autoplay class="preview-video"></video>
      <audio v-else-if="previewItemData?.type === 'audio'" :src="previewItemData.path" controls autoplay class="preview-audio"></audio>
      <div class="preview-info">
        <span>{{ previewItemData?.filename }}</span>
        <span>{{ previewItemData ? formatSize(previewItemData.size) : '' }}</span>
        <button class="copy-btn" @click="copyPath(previewItemData?.path)">复制路径</button>
      </div>
    </div>

    <div v-if="deleteTarget" class="media-preview-overlay" @click.self="deleteTarget = null">
      <div class="delete-confirm">
        <p>确定要删除这个文件吗？</p>
        <p class="delete-filename">{{ deleteTarget.filename }}</p>
        <p class="delete-warning">此操作不可撤销</p>
        <div class="delete-btns">
          <button class="cancel-btn" @click="deleteTarget = null">取消</button>
          <button class="confirm-delete-btn" :disabled="deleting" @click="doDelete">{{ deleting ? '删除中...' : '确认删除' }}</button>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" class="media-toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getMediaList, deleteMedia, uploadFiles } from '@/api/upload';

const router = useRouter();
const authStore = useAuthStore();
const fileInput = ref(null);

const type = ref('image');
const page = ref(1);
const limit = 20;
const items = ref([]);
const total = ref(0);
const totalPages = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const toastMsg = ref('');
const toastType = ref('success');
const previewVisible = ref(false);
const previewItemData = ref(null);
const deleteTarget = ref(null);
const deleting = ref(false);

const tabs = [
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
];

const hasMore = computed(() => page.value < totalPages.value);

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function showToast(msg, t = 'success') {
  toastMsg.value = msg;
  toastType.value = t;
  setTimeout(() => { toastMsg.value = ''; }, 2200);
}

async function fetchMedia(reset = false) {
  if (reset) {
    page.value = 1;
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    const res = await getMediaList({ type: type.value, page: page.value, limit });
    const data = res.data.data;
    if (reset) {
      items.value = data.items;
    } else {
      items.value = [...items.value, ...data.items];
    }
    total.value = data.total;
    totalPages.value = data.totalPages;
  } catch (err) {
    showToast('加载失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function switchTab(t) {
  if (type.value === t) return;
  type.value = t;
  fetchMedia(true);
}

function loadMore() {
  page.value++;
  fetchMedia(false);
}

function triggerUpload() {
  fileInput.value.click();
}

async function handleUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }

  const mediaType = type.value === 'audio' ? 'music' : type.value === 'video' ? 'video' : 'image';

  try {
    showToast(`正在上传 ${files.length} 个文件...`);
    await uploadFiles(formData, { type: type.value, mediaType });
    showToast('上传成功');
    fetchMedia(true);
  } catch (err) {
    showToast('上传失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    e.target.value = '';
  }
}

function previewItem(item) {
  previewItemData.value = item;
  previewVisible.value = true;
}

async function copyPath(p) {
  try {
    await navigator.clipboard.writeText(p);
    showToast('路径已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = p;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('路径已复制');
  }
}

function confirmDelete(item) {
  deleteTarget.value = item;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await deleteMedia(deleteTarget.value.path);
    showToast('已删除');
    deleteTarget.value = null;
    fetchMedia(true);
  } catch (err) {
    showToast('删除失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  fetchMedia(true);
});
</script>
