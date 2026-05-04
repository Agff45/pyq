<template>
  <div class="settings-page">
    <header class="editor-topbar">
      <button class="back-btn" @click="$router.push('/editor')"><span>←</span> 返回</button>
      <h2>站点设置</h2>
      <button class="logout-btn" @click="handleLogout">退出</button>
    </header>

    <main class="settings-main">
      <form class="settings-card" @submit.prevent="handleSave">
        <section class="settings-section">
          <div class="settings-section-head">
            <h3>个人信息</h3>
            <p>控制首页头像、昵称和签名展示。</p>
          </div>

          <div class="settings-grid two-cols">
            <label class="settings-field">
              <span>网站标题</span>
              <input v-model="form.title" type="text" placeholder="我的朋友圈" />
            </label>
            <label class="settings-field">
              <span>显示名称</span>
              <input v-model="form.username" type="text" placeholder="您的名字" />
            </label>
          </div>

          <label class="settings-field">
            <span>个人简介</span>
            <textarea v-model="form.description" rows="3" placeholder="这是我的个人动态展示页"></textarea>
          </label>

          <div class="settings-media-row">
            <div class="settings-preview avatar-preview">
              <img v-if="form.avatar" :src="form.avatar" alt="头像预览" />
              <span v-else>头像</span>
            </div>
            <label class="settings-field flex-1">
              <span>头像地址</span>
              <div class="settings-upload-line">
                <input v-model="form.avatar" type="text" placeholder="/images/avatar.jpg" />
                <button type="button" class="settings-upload-btn" @click="triggerUpload('avatar', 'image')">上传</button>
              </div>
            </label>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-head">
            <h3>首页外观</h3>
            <p>自定义顶部封面和固定导航栏背景。</p>
          </div>

          <div class="settings-media-row align-start">
            <div class="settings-preview cover-preview-large">
              <video v-if="isVideo(form.headerMedia)" :src="form.headerMedia" muted playsinline loop></video>
              <img v-else-if="form.headerMedia" :src="form.headerMedia" alt="顶部封面预览" />
              <span v-else>顶部封面</span>
            </div>
            <label class="settings-field flex-1">
              <span>顶部封面图片/视频</span>
              <div class="settings-upload-line">
                <input v-model="form.headerMedia" type="text" placeholder="/images/header.png 或 /videos/header.mp4" />
                <button type="button" class="settings-upload-btn" @click="triggerUpload('headerMedia', 'all')">上传</button>
              </div>
              <small>支持图片或视频。视频会作为首页顶部动态封面。</small>
            </label>
          </div>

          <div class="settings-grid two-cols">
            <label class="settings-field">
              <span>导航栏初始背景</span>
              <div class="settings-upload-line">
                <input v-model="form.navBackground" type="text" placeholder="transparent / rgba(...) / #ffffff" />
                <button type="button" class="settings-upload-btn" @click="triggerUpload('navBackground', 'image')">图片</button>
              </div>
            </label>
            <label class="settings-field">
              <span>滚动后导航栏背景</span>
              <div class="settings-upload-line">
                <input v-model="form.navScrolledBackground" type="text" placeholder="rgba(255,255,255,.82)" />
                <button type="button" class="settings-upload-btn" @click="triggerUpload('navScrolledBackground', 'image')">图片</button>
              </div>
            </label>
          </div>
          <p class="settings-help">背景可以填颜色值、CSS 渐变，或上传图片后自动填入 `url(...)`。</p>
        </section>

        <section class="settings-section">
          <div class="settings-section-head">
            <h3>全局选项</h3>
            <p>控制字体、页脚和基础功能开关。</p>
          </div>

          <div class="settings-grid two-cols">
            <label class="settings-field">
              <span>字体</span>
              <select v-model="form.fontFamily">
                <option value="ZQL">ZQL</option>
                <option value="PingFangQiaoMuTi">PingFangQiaoMuTi</option>
                <option value="AlimamaFangYuanTi">AlimamaFangYuanTi</option>
              </select>
            </label>
            <label class="settings-field">
              <span>页脚文字</span>
              <input v-model="form.footerText" type="text" placeholder="© 2026 Designed by Amigo" />
            </label>
          </div>

          <div class="settings-checks">
            <label><input v-model="form.enablePjax" type="checkbox" /> 开启 PJAX</label>
            <label><input v-model="form.enableLightbox" type="checkbox" /> 开启图片灯箱</label>
          </div>
        </section>

        <div class="settings-footer">
          <p class="settings-status" :class="toastType">{{ toastMsg }}</p>
          <button type="submit" class="publish-btn" :disabled="saving || loading">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </form>
    </main>

    <input ref="fileInput" type="file" hidden @change="handleUpload" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getSettings, updateSettings } from '@/api/settings';
import { uploadFiles } from '@/api/upload';

const router = useRouter();
const authStore = useAuthStore();
const fileInput = ref(null);
const pendingUpload = ref({ field: '', type: 'image' });
const loading = ref(false);
const saving = ref(false);
const toastMsg = ref('');
const toastType = ref('success');

const form = reactive({
  title: '',
  username: '',
  description: '',
  avatar: '',
  headerMedia: '',
  navBackground: '',
  navScrolledBackground: '',
  footerText: '',
  fontFamily: 'ZQL',
  enablePjax: true,
  enableLightbox: true,
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function isVideo(src) {
  return /\.(mp4|webm|ogg|mov)$/i.test(src || '');
}

function showToast(message, type = 'success') {
  toastMsg.value = message;
  toastType.value = type;
  setTimeout(() => { toastMsg.value = ''; }, 2600);
}

async function loadSettings() {
  loading.value = true;
  try {
    const res = await getSettings();
    Object.assign(form, res.data.data || {});
  } catch (err) {
    showToast('读取设置失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    loading.value = false;
  }
}

function triggerUpload(field, type) {
  pendingUpload.value = { field, type };
  const input = fileInput.value;
  if (!input) return;
  input.accept = type === 'all' ? 'image/*,video/*' : 'image/*';
  input.click();
}

async function handleUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const { field, type } = pendingUpload.value;
  const isVideoFile = file.type.startsWith('video/');
  const formData = new FormData();
  formData.append('files', file);
  formData.append('type', type === 'all' ? (isVideoFile ? 'video' : 'image') : 'image');
  formData.append('mediaType', isVideoFile ? 'video' : 'site');

  try {
    showToast('上传中...');
    const res = await uploadFiles(formData, {
      type: type === 'all' ? (isVideoFile ? 'video' : 'image') : 'image',
      mediaType: isVideoFile ? 'video' : 'site',
    });
    const uploaded = res.data.data.files[0];
    form[field] = field.includes('Background') ? `url('${uploaded.path}')` : uploaded.path;
    showToast('上传成功');
  } catch (err) {
    showToast('上传失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    e.target.value = '';
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const payload = { ...form };
    await updateSettings(payload);
    showToast('设置已保存，正在重新构建站点');
  } catch (err) {
    showToast('保存失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>
