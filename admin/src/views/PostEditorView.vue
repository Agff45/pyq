<template>
  <div class="editor-page">
    <header class="editor-topbar">
      <div class="topbar-left">
        <button class="back-btn" @click="$router.push('/posts')"><span>‹</span>文章管理</button>
      </div>
      <h2>{{ isEdit ? '编辑动态' : '发新动态' }}</h2>
      <div class="topbar-actions">
        <button class="logout-btn" @click="$router.push('/media')">媒体库</button>
        <button class="logout-btn" @click="$router.push('/settings')">设置</button>
        <span class="topbar-sep"></span>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="editor-main">
      <div class="editor-card">

        <!-- 正文编辑区 -->
        <div class="editor-body">
          <textarea
            ref="textareaRef"
            v-model="contentText"
            class="editor-textarea"
            placeholder="这一刻的想法..."
            rows="6"
          ></textarea>

          <!-- 图片九宫格 -->
          <div class="editor-images" v-if="galleryImages.length > 0">
            <div class="image-grid" :class="gridLayoutClass">
              <div v-for="(img, idx) in galleryImages" :key="idx" class="grid-item"
                   draggable="true"
                   @dragstart="onDragStart(idx)"
                   @dragover.prevent
                   @drop="onDrop(idx)">
                <img :src="img.preview || img.path" alt="" />
                <button class="remove-img" @click="removeImage(idx)">×</button>
              </div>
            </div>
          </div>

          <div class="add-image-row" v-if="galleryImages.length < 9">
            <button class="add-image-btn" @click="triggerUpload">
              <span class="add-icon">+</span>
              <span>添加图片 ({{ galleryImages.length }}/9)</span>
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="handleFileChange" />

          <!-- 媒体插入工具栏 -->
          <div class="media-toolbar">
            <span class="toolbar-label">插入媒体：</span>
            <button class="tool-btn" @click="openModal('musicCard')" title="音乐卡片">🎵 音乐</button>
            <button class="tool-btn" @click="openModal('video')" title="视频">🎬 视频</button>
            <button class="tool-btn" @click="openModal('voice')" title="语音">🎤 语音</button>
            <button class="tool-btn" @click="openModal('livephoto')" title="实况照片">📸 实况照片</button>
          </div>
        </div>

        <!-- 属性设置区 -->
        <div class="editor-meta">
          <div class="meta-section-title">属性设置</div>

          <div class="meta-row">
            <label class="meta-label">标题</label>
            <input v-model="meta.title" type="text" class="meta-input" placeholder="给这条动态起个标题" />
          </div>
          <div class="meta-row">
            <label class="meta-label">作者</label>
            <input v-model="meta.author" type="text" class="meta-input" placeholder="显示的作者名，留空用默认" />
          </div>
          <div class="meta-row">
            <label class="meta-label">地点</label>
            <input v-model="meta.location" type="text" class="meta-input" placeholder="如：武汉·东湖" />
          </div>
          <div class="meta-row">
            <label class="meta-label">标签</label>
            <input v-model="tagsInput" type="text" class="meta-input" placeholder="用逗号分隔，如：生活, 摄影" />
          </div>

          <div class="meta-checks">
            <label class="check-item">
              <input type="checkbox" v-model="meta.isLongArticle" />
              <span>长文章模式（首页显示为卡片）</span>
            </label>
          </div>

          <div v-if="meta.isLongArticle" class="meta-row meta-cover-row">
            <label class="meta-label">封面图</label>
            <div class="cover-picker">
              <div v-if="meta.cover" class="cover-preview">
                <img :src="meta.cover" alt="封面" />
                <button class="cover-remove" @click="meta.cover = ''">×</button>
              </div>
              <button v-else class="cover-upload-btn" @click="triggerCoverUpload">
                + 上传封面
              </button>
              <input
                ref="coverInput"
                type="file"
                accept="image/*"
                hidden
                @change="handleCoverUpload"
              />
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="editor-footer">
          <p v-if="lastSaved" class="save-info">
            {{ meta.isLongArticle ? '长文章' : '朋友圈动态' }} · {{ galleryImages.length }} 张图片
          </p>
          <div class="footer-btns">
            <button class="btn-draft" @click="handleSaveDraft" :disabled="saving">
              {{ saving ? '保存中...' : '保存草稿' }}
            </button>
            <button class="publish-btn" @click="handlePublish" :disabled="saving">
              {{ saving ? '发布中...' : (meta.draft ? '发布' : '发布') }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 媒体插入模态框 -->
    <div v-if="modalVisible" class="modal-mask" @click.self="modalVisible = false">
      <div class="modal-card">

        <!-- 音乐卡片 -->
        <template v-if="modalType === 'musicCard'">
          <h3>插入音乐卡片</h3>
          <div class="modal-field"><label>音频文件</label><div class="field-with-upload"><input v-model="modalForm.src" placeholder="Meting API地址 / 直链 / 或上传文件" /><button class="upload-mini-btn" @click="uploadToField('src','music','audio')" title="上传音乐">📁</button></div></div>
          <div class="modal-field"><label>封面图</label><div class="field-with-upload"><input v-model="modalForm.cover" placeholder="封面图地址 / 或上传" /><button class="upload-mini-btn" @click="uploadToField('cover','cover','image')" title="上传封面">🖼️</button></div></div>
          <div class="modal-field"><label>歌曲名</label><input v-model="modalForm.name" placeholder="歌曲名" /></div>
          <div class="modal-field"><label>艺术家</label><input v-model="modalForm.artist" placeholder="艺术家" /></div>
          <div class="modal-field"><label>主题色</label><input v-model="modalForm.accent" placeholder="#d43c33" /></div>
        </template>

        <!-- 视频 -->
        <template v-if="modalType === 'video'">
          <h3>插入视频</h3>
          <div class="modal-field"><label>视频文件</label><div class="field-with-upload"><input v-model="modalForm.src" placeholder="本地路径 / B站链接 / 外链 / 或上传" /><button class="upload-mini-btn" @click="uploadToField('src','video','video')" title="上传视频">📁</button></div></div>
          <div class="modal-field"><label>封面图</label><div class="field-with-upload"><input v-model="modalForm.poster" placeholder="可选 / 或上传" /><button class="upload-mini-btn" @click="uploadToField('poster','cover','image')" title="上传封面">🖼️</button></div></div>
          <div class="modal-row">
            <div class="modal-field half"><label>宽高比</label>
              <select v-model="modalForm.ratio"><option>16/9</option><option>4/3</option><option>3/4</option><option>1/1</option></select>
            </div>
            <div class="modal-field half"><label>B站分P</label><input v-model="modalForm.page" placeholder="1" /></div>
          </div>
          <div class="modal-checks">
            <label><input type="checkbox" v-model="modalForm.autoplay" /> 自动播放</label>
            <label><input type="checkbox" v-model="modalForm.loop" /> 循环播放</label>
            <label><input type="checkbox" v-model="modalForm.muted" /> 静音</label>
          </div>
        </template>

        <!-- 语音 -->
        <template v-if="modalType === 'voice'">
          <h3>插入语音消息</h3>
          <div class="modal-field"><label>音频文件</label><div class="field-with-upload"><input v-model="modalForm.src" placeholder="MP3 路径 / 外链 / 或上传" /><button class="upload-mini-btn" @click="uploadToField('src','voice','audio')" title="上传语音">📁</button></div></div>
          <div class="modal-field"><label>显示时长(秒)</label><input v-model="modalForm.duration" placeholder="留空自动检测" /></div>
        </template>

        <!-- 实况照片（三合一） -->
        <template v-if="modalType === 'livephoto'">
          <h3>插入实况照片</h3>
          <div class="modal-field"><label>封面图片</label><div class="field-with-upload"><input v-model="modalForm.image" placeholder="图片路径 / 或上传" /><button class="upload-mini-btn" @click="uploadToField('image','livephoto','image')" title="上传图片">🖼️</button></div></div>
          <div class="modal-field"><label>视频文件</label><div class="field-with-upload"><input v-model="modalForm.video" placeholder="视频路径 / 或上传（不填自动推导）" /><button class="upload-mini-btn" @click="uploadToField('video','livephoto','video')" title="上传视频">📁</button></div></div>
          <div class="modal-row">
            <div class="modal-field half"><label>宽高比</label>
              <select v-model="modalForm.ratio">
                <option value="9/16">9/16 — 竖屏 (手机直拍)</option>
                <option value="3/4">3/4 — 经典相机 (iPhone默认)</option>
                <option value="1/1">1/1 — 正方形 (头像/封面)</option>
                <option value="4/3">4/3 — 横屏相机 (iPad/微单)</option>
                <option value="16/9">16/9 — 宽屏视频 (显示器/电影)</option>
              </select>
            </div>
            <div class="modal-field half"><label>触发延迟(ms)</label><input v-model="modalForm.delay" placeholder="500" /></div>
          </div>
        </template>

        <input ref="modalFileInput" type="file" hidden @change="handleModalFileChange" />

        <!-- 模态框底部按钮 -->
        <div class="modal-actions">
          <button class="btn-cancel" @click="modalVisible = false">取消</button>
          <button class="btn-confirm" @click="insertShortcode">插入</button>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { createPost, updatePost, getPost } from '@/api/posts';
import { uploadFiles } from '@/api/upload';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const editingFilename = computed(() => {
  const fromQuery = route.query.file;
  const fromParam = route.params.filename;
  return String(Array.isArray(fromQuery) ? fromQuery[0] : (fromQuery || fromParam || ''));
});
const isEdit = computed(() => !!editingFilename.value);
const contentText = ref('');
const galleryImages = ref([]);
const meta = reactive({
  title: '', author: '', location: '',
  isLongArticle: false, cover: '', draft: false,
});
const tagsInput = ref('');
const saving = ref(false);
const toastMsg = ref('');
const toastType = ref('success');
const lastSaved = ref('');
const fileInput = ref(null);
const coverInput = ref(null);
const textareaRef = ref(null);

const galleryTags = computed(() => {
  return tagsInput.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
});

const gridLayoutClass = computed(() => {
  const n = galleryImages.value.length;
  if (n <= 1) return 'grid-1';
  if (n === 2 || n === 4) return 'grid-2';
  return 'grid-3';
});

const modalVisible = ref(false);
const modalType = ref('');
const modalFileInput = ref(null);
const pendingUploadTarget = ref({ field: '', mediaType: '', fileType: '' });
const modalForm = reactive({
  src: '', cover: '', name: '', artist: '', accent: '#d43c33',
  poster: '', ratio: '9/16', autoplay: false, loop: false, muted: false, page: '1',
  duration: '', image: '', video: '', delay: '500',
});

function resetModalForm() {
  Object.assign(modalForm, {
    src: '', cover: '', name: '', artist: '', accent: '#d43c33',
    poster: '', ratio: '9/16', autoplay: false, loop: false, muted: false, page: '1',
    duration: '', image: '', video: '', delay: '500',
  });
}

function openModal(type) {
  modalType.value = type;
  resetModalForm();
  modalVisible.value = true;
}

function uploadToField(fieldName, mediaType, fileType) {
  pendingUploadTarget.value = { field: fieldName, mediaType, fileType };
  const input = modalFileInput.value;
  if (!input) return;
  if (fileType === 'audio') input.accept = '.mp3,.wav,.flac,.aac,.m4a,.ogg';
  else if (fileType === 'video') input.accept = '.mp4,.webm,.mov,.avi,.mkv';
  else input.accept = 'image/*';
  input.click();
}

async function handleModalFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const { field, mediaType, fileType } = pendingUploadTarget.value;

  const formData = new FormData();
  formData.append('files', file);
  formData.append('mediaType', mediaType);
  formData.append('type', fileType);

  try {
    const res = await uploadFiles(formData, { mediaType, type: fileType });
    const uploaded = res.data.data.files[0];
    modalForm[field] = uploaded.path;
    showToast('已上传，路径已自动填入');
  } catch (err) {
    showToast('上传失败: ' + (err.response?.data?.message || err.message), 'error');
  }
  e.target.value = '';
}

function insertShortcode() {
  let shortcode = '';
  const m = modalForm;

  switch (modalType.value) {
    case 'musicCard':
      shortcode = `{{< music-card\n    src="${m.src}"\n    cover="${m.cover}"\n    name="${m.name}"\n    artist="${m.artist}"\n    accent="${m.accent}"\n>}}`;
      break;
    case 'video': {
      const flags = [];
      if (m.autoplay) flags.push('autoplay="true"');
      if (m.loop) flags.push('loop="true"');
      if (m.muted) flags.push('muted="true"');
      shortcode = `{{< video src="${m.src}"${m.poster ? ` poster="${m.poster}"` : ''} ratio="${m.ratio}"${m.page !== '1' ? ` page="${m.page}"` : ''}${flags.length ? ' ' + flags.join(' ') : ''} >}}`;
      break;
    }
    case 'voice': {
      const durPart = m.duration ? ` duration="${m.duration}"` : '';
      shortcode = `{{< voice src="${m.src}"${durPart} >}}`;
      break;
    }
    case 'livephoto':
      shortcode = `{{< motion-photo\n    image="${m.image}"\n    video="${m.video}"\n    ratio="${m.ratio}"\n    delay="${m.delay}"\n>}}`;
      break;
    default:
      break;
  }

  if (shortcode) {
    const ta = textareaRef.value;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = contentText.value.substring(0, start);
      const after = contentText.value.substring(end);
      contentText.value = before + '\n' + shortcode + '\n' + after;
      nextTick(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + shortcode.length + 2;
      });
    } else {
      contentText.value += '\n' + shortcode + '\n';
    }
  }

  modalVisible.value = false;
  showToast('已插入');
}

function triggerUpload() {
  if (fileInput.value) fileInput.value.click();
}

function triggerCoverUpload() {
  if (coverInput.value) coverInput.value.click();
}

async function handleFileChange(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  formData.append('type', 'image');

  try {
    showToast('上传图片中...');
    const res = await uploadFiles(formData);
    const uploaded = res.data.data.files;
    uploaded.forEach((f) => {
      if (galleryImages.value.length < 9) {
        galleryImages.value.push({ path: f.path, preview: f.path, uploaded: true });
      }
    });
    showToast(`已上传 ${uploaded.length} 张图片`, 'success');
  } catch (err) {
    showToast('上传失败: ' + (err.response?.data?.message || err.message), 'error');
  }
  e.target.value = '';
}

async function handleCoverUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('files', file);
  formData.append('type', 'image');
  try {
    const res = await uploadFiles(formData);
    meta.cover = res.data.data.files[0].path;
  } catch (err) {
    showToast('封面上传失败', 'error');
  }
  e.target.value = '';
}

function removeImage(idx) {
  galleryImages.value.splice(idx, 1);
}

let dragIdx = -1;

function onDragStart(idx) {
  dragIdx = idx;
}

function onDrop(idx) {
  if (dragIdx < 0 || dragIdx === idx) return;
  const items = [...galleryImages.value];
  const [moved] = items.splice(dragIdx, 1);
  items.splice(idx, 0, moved);
  galleryImages.value = items;
  dragIdx = -1;
}

async function doSave(draft) {
  if (!contentText.value.trim() && galleryImages.value.length === 0 && !meta.title.trim()) {
    showToast('请至少填写内容、上传图片或填写标题', 'error');
    return;
  }
  saving.value = true;

  const payload = {
    title: meta.title,
    content: contentText.value,
    author: meta.author,
    location: meta.location,
    tags: galleryTags.value,
    images: galleryImages.value.map((i) => i.path),
    isLongArticle: meta.isLongArticle,
    cover: meta.cover,
    draft,
  };

  try {
    if (isEdit.value) {
      await updatePost(editingFilename.value, payload);
      showToast(draft ? '草稿已保存' : '更新成功', 'success');
    } else {
      const res = await createPost(payload);
      showToast('发布成功！', 'success');
      lastSaved.value = res.data.data.filename;
      setTimeout(() => router.push('/posts'), 1200);
    }
  } catch (err) {
    showToast('操作失败: ' + (err.response?.data?.message || err.message), 'error');
  } finally {
    saving.value = false;
  }
}

function handlePublish() {
  doSave(false);
}

function handleSaveDraft() {
  doSave(true);
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

onMounted(async () => {
  if (isEdit.value) {
    try {
      const res = await getPost(editingFilename.value);
      const d = res.data.data;
      contentText.value = d.content || '';
      meta.title = d.frontMatter.title || '';
      meta.author = d.frontMatter.author || '';
      meta.location = d.frontMatter.location || '';
      meta.isLongArticle = !!d.frontMatter.isLongArticle;
      meta.cover = d.frontMatter.cover || '';
      meta.draft = !!d.frontMatter.draft;
      tagsInput.value = (d.frontMatter.tags || []).join(', ');
      if (d.frontMatter.images) {
        galleryImages.value = d.frontMatter.images.map((p) => ({ path: p, preview: p, uploaded: true }));
      }
    } catch (err) {
      showToast('加载文章失败', 'error');
    }
  }
});
</script>
