/* ==========================================================================
   全局音频管理器 - 保证 PJAX 切换页面时音乐不中断
   ========================================================================== */
const AudioManager = {
    _audio: null,
    _playing: false,
    _src: null,
    _currentTime: 0,

    get audio() {
        if (!this._audio) {
            this._audio = new Audio();
            this._audio.preload = 'metadata';
            this._audio.style.display = 'none';
            document.body.appendChild(this._audio);
            this._audio.addEventListener('play', () => { this._playing = true; });
            this._audio.addEventListener('pause', () => { this._playing = false; });
            this._audio.addEventListener('timeupdate', () => {
                this._currentTime = this._audio.currentTime;
            });
        }
        return this._audio;
    },

    get isPlaying() { return this._playing; },
    get src() { return this._src; },

    load(src) {
        this._src = src;
        this.audio.src = src;
        this.audio.load();
    },

    play() {
        this.audio.play().catch(() => {});
    },

    pause() {
        this.audio.pause();
    },

    // 将全局 audio 关联到播放器 UI（绑定 UI 事件）
    attach(player) {
        const a = this.audio;
        // 移除旧的 UI 事件监听（通过命名空间标记）
        a._player = player;
    },

    detach() {
        if (this._audio) {
            this._audio._player = null;
        }
    }
};

document.addEventListener("DOMContentLoaded", function() {
    initMoments();
    initLightbox();
    initTheme();
    initThemeToggle();
    initHeaderMedia();
    initArchiveFilter();
    initHomeSearch();
    initMomentActionMenus();
    initHomeFloatingBar();
    initMusicPlayers();
    initLivePhotoCards();
    initMusicCardPlayers();
    initMotionPhotos();
    initVideoPlayers();
    initVoiceMessages();
});

// 页面加载完了（包括 PJAX 跳完后），重新初始化一波
document.addEventListener("pjax:complete", function() {
    initMoments();
    initLightbox();
    initThemeToggle();
    initHeaderMedia();
    initArchiveFilter();
    initHomeSearch();
    initMomentActionMenus();
    initHomeFloatingBar();
    initLivePhotoCards();
    initMotionPhotos();
    initVideoPlayers();
    initVoiceMessages();
    // 音乐播放器：如果正在播放则只关联 UI，不重新初始化
    if (AudioManager.isPlaying) {
        attachPlayingMusicPlayer();
    } else {
        initMusicPlayers();
        initMusicCardPlayers();
    }
});

function initMenu() {
    // 选一下菜单开关和遮罩层
    const toggle = document.querySelector('#menu-toggle');
    const overlay = document.querySelector('#menu-overlay');
    
    if (!toggle || !overlay) {
        // console.log('找不到菜单元素');
        return;
    }

    // 克隆一下再替换，主要是为了清掉之前的事件监听器，防止重复绑定
    const newToggle = toggle.cloneNode(true);
    if (toggle.parentNode) {
        toggle.parentNode.replaceChild(newToggle, toggle);
    }
    
    // 遮罩层也一样，克隆一份干净的
    const newOverlay = overlay.cloneNode(true);
    if (overlay.parentNode) {
        overlay.parentNode.replaceChild(newOverlay, overlay);
    }

    const toggleMenu = (e) => {
        e.preventDefault(); // 别让 a 标签乱跳
        const isActive = newOverlay.classList.contains('active');
        if (isActive) {
            newOverlay.classList.remove('active');
            document.body.style.overflow = ''; // 恢复滚动
        } else {
            newOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // 菜单开了就别让背景滚了
        }
    };

    newToggle.addEventListener('click', toggleMenu);
    
    newOverlay.addEventListener('click', (e) => {
        if (e.target === newOverlay) {
            toggleMenu(e); // 点遮罩层外面也关掉
        }
    });
}

/* ==========================================================================
   主题管理（深色/浅色模式）
   ========================================================================== */

function showActionFeedback(text) {
    if (window.Qmsg && typeof window.Qmsg.success === 'function') {
        window.Qmsg.success(text);
        return;
    }

    const old = document.querySelector('.action-feedback-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'action-feedback-toast';
    toast.textContent = text;
    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('is-hiding');
        window.setTimeout(() => toast.remove(), 180);
    }, 1500);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const input = document.createElement('textarea');
        input.value = text;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();

        try {
            const ok = document.execCommand('copy');
            document.body.removeChild(input);
            ok ? resolve() : reject(new Error('copy failed'));
        } catch (err) {
            document.body.removeChild(input);
            reject(err);
        }
    });
}

function closeMomentActionMenus(except) {
    document.querySelectorAll('.action-wrapper.is-open').forEach(wrapper => {
        if (wrapper === except) return;
        wrapper.classList.remove('is-open');
        const toggle = wrapper.querySelector('.action-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

function initMomentActionMenus() {
    const wrappers = document.querySelectorAll('.moment-card .action-wrapper');
    if (!wrappers.length) return;

    wrappers.forEach(wrapper => {
        const toggle = wrapper.querySelector('.action-toggle');
        const copyBtn = wrapper.querySelector('.action-copy-link');
        const shareBtn = wrapper.querySelector('.action-share-post');
        if (!toggle || toggle._actionMenuBound) return;

        toggle._actionMenuBound = true;
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const willOpen = !wrapper.classList.contains('is-open');
            closeMomentActionMenus(wrapper);
            wrapper.classList.toggle('is-open', willOpen);
            toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const url = toggle.dataset.postUrl || window.location.href;
                copyTextToClipboard(url)
                    .then(() => {
                        closeMomentActionMenus();
                        showActionFeedback('链接已复制');
                    })
                    .catch(() => showActionFeedback('复制失败'));
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const url = toggle.dataset.postUrl || window.location.href;
                const title = toggle.dataset.postTitle || document.title;

                if (navigator.share) {
                    navigator.share({ title, url })
                        .then(() => closeMomentActionMenus())
                        .catch(() => {});
                } else {
                    copyTextToClipboard(url)
                        .then(() => {
                            closeMomentActionMenus();
                            showActionFeedback('链接已复制');
                        })
                        .catch(() => showActionFeedback('分享失败'));
                }
            });
        }
    });

    if (!document._momentActionMenusBound) {
        document._momentActionMenusBound = true;
        document.addEventListener('click', () => closeMomentActionMenus());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMomentActionMenus();
        });
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 应用主题的函数
    function apply(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // 初始化时：有本地存储就用本地的，没有就用系统的
    if (savedTheme) {
        apply(savedTheme === 'dark');
    } else {
        apply(mediaQuery.matches);
    }

    // 监听系统主题变化：如果用户没手动设置过，就跟随系统
    mediaQuery.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            apply(e.matches);
        }
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const isDark = current === 'dark';
    const targetDark = !isDark;
    
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if (typeof Qmsg !== 'undefined') Qmsg.info('切到亮色模式啦');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (typeof Qmsg !== 'undefined') Qmsg.success('切到深色模式啦');
    }

}

// 点击头像就能切换主题，挺方便的
document.addEventListener('click', (e) => {
    if (e.target.closest('.header-avatar')) {
        toggleTheme();
    }
});

// 监听系统主题变化，要是用户没手动改过，就跟着系统走
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        if (e.matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
});

function initThemeToggle() {
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(btn => {
        // 老规矩，克隆一份清掉监听器
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTheme();
        });
    });
}

function initLightbox() {
    // 图片浏览器初始化
    if (window.ViewImage) {
        ViewImage.init('.moment-gallery img, .article-gallery img, .article-text img:not(.live-photo-poster):not([no-view])');
    }
}

function initHomeSearch() {
    var header = document.querySelector('.home-header');
    if (!header) return;
    var container = document.getElementById('header-search');
    var toggle = document.getElementById('header-search-toggle');
    var input = document.getElementById('home-search-input');
    var clearBtn = document.getElementById('home-search-clear');
    if (!container || !toggle || !input || !clearBtn) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('.moments-feed .moment-card'));
    var timer = null;

    function applyFilter(q) {
        var query = (q || '').trim().toLowerCase();
        var anyVisible = false;
        cards.forEach(function(card) {
            var authorEl = card.querySelector('.moment-author');
            var textEl = card.querySelector('.moment-text');
            var timeEl = card.querySelector('.moment-time');
            var locationEl = card.querySelector('.moment-location');
            var tagsEl = card.querySelector('.moment-tags');
            
            var author = authorEl ? authorEl.textContent.trim().toLowerCase() : '';
            var text = textEl ? textEl.textContent.trim().toLowerCase() : '';
            var time = timeEl ? timeEl.textContent.trim().toLowerCase() : '';
            var location = locationEl ? locationEl.textContent.trim().toLowerCase() : '';
            var tags = tagsEl ? tagsEl.textContent.trim().toLowerCase() : '';
            
            var hit = !query || 
                      author.indexOf(query) !== -1 || 
                      text.indexOf(query) !== -1 || 
                      time.indexOf(query) !== -1 || 
                      location.indexOf(query) !== -1 ||
                      tags.indexOf(query) !== -1;
            
            card.style.display = hit ? '' : 'none';
            if (hit) anyVisible = true;
        });
        clearBtn.style.display = input.value ? 'flex' : 'none';
        var emptyTip = document.getElementById('home-search-empty');
        if (!emptyTip) {
            emptyTip = document.createElement('div');
            emptyTip.id = 'home-search-empty';
            emptyTip.style.margin = '10px 0';
            emptyTip.style.color = 'var(--text-muted)';
            emptyTip.style.textAlign = 'center';
            emptyTip.style.display = 'none';
            var feed = document.querySelector('.moments-feed');
            if (feed) feed.prepend(emptyTip);
        }
        emptyTip.textContent = '未找到匹配的内容';
        emptyTip.style.display = anyVisible ? 'none' : 'block';
    }

    function openSearch() {
        container.classList.add('is-open');
        setTimeout(function() { input.focus(); }, 350);
    }

    function closeSearch() {
        container.classList.remove('is-open');
        input.value = '';
        applyFilter('');
    }

    var newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    toggle = newToggle;

    var newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    input = newInput;

    var newClear = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClear, clearBtn);
    clearBtn = newClear;

    toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        if (container.classList.contains('is-open')) {
            closeSearch();
        } else {
            openSearch();
        }
    });

    document.addEventListener('click', function(e) {
        if (container.classList.contains('is-open') && !container.contains(e.target)) {
            closeSearch();
        }
    });

    input.addEventListener('input', function() {
        if (timer) clearTimeout(timer);
        var value = input.value;
        timer = setTimeout(function() { applyFilter(value); }, 150);
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSearch();
        }
    });

    clearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        input.value = '';
        applyFilter('');
    });

    // 监听标签点击，自动填充搜索框并过滤
    var feed = document.querySelector('.moments-feed');
    if (feed) {
        feed.addEventListener('click', function(e) {
            // 点击标签
            if (e.target.classList.contains('moment-tag')) {
                e.preventDefault();
                e.stopPropagation();
                var tagName = e.target.textContent.replace('#', '').trim();
                openSearch();
                input.value = tagName;
                applyFilter(tagName);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // 点击地点
            else if (e.target.classList.contains('moment-location')) {
                e.preventDefault();
                e.stopPropagation();
                var locName = e.target.textContent.trim();
                openSearch();
                input.value = locName;
                applyFilter(locName);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    applyFilter('');
}
function initArchiveFilter() {
    var container = document.querySelector('.archive-view');
    if (!container) return;

    var header = document.getElementById('archive-header');
    var blocks = container.querySelectorAll('.archive-year-block');
    var card = document.getElementById('archive-author-card');
    var cardName = card ? card.querySelector('.archive-author-name') : null;
    var cardMeta = card ? card.querySelector('.archive-author-meta') : null;
    var cardAvatar = card ? card.querySelector('.archive-author-avatar img') : null;

    if (!header || !blocks.length) return;

    var params = new URLSearchParams(window.location.search);
    var author = params.get('author');
    author = author ? author.trim() : '';

    if (!author) {
        header.textContent = '所有文章';
        blocks.forEach(function(block) {
            block.style.display = '';
            var items = block.querySelectorAll('.archive-item');
            items.forEach(function(item) {
                item.style.display = '';
            });
        });
        if (card) {
            card.style.display = 'none';
        }
        return;
    }

    var target = author.toLowerCase();
    var totalVisible = 0;

    var avatarSrc = '';
    var allItems = container.querySelectorAll('.archive-item');
    allItems.forEach(function(item) {
        var a = item.getAttribute('data-author') || '';
        a = a.trim().toLowerCase();
        if (!avatarSrc && a && a === target) {
            avatarSrc = item.getAttribute('data-avatar') || '';
        }
    });

    blocks.forEach(function(block) {
        var items = block.querySelectorAll('.archive-item');
        var anyVisible = false;

        items.forEach(function(item) {
            var a = item.getAttribute('data-author') || '';
            a = a.trim().toLowerCase();
            if (a && a === target) {
                item.style.display = '';
                anyVisible = true;
                totalVisible++;
            } else {
                item.style.display = 'none';
            }
        });

        block.style.display = anyVisible ? '' : 'none';
    });

    if (totalVisible > 0) {
        header.textContent = '作者：' + author + ' 的文章';
        if (card) {
            card.style.display = 'flex';
        }
        if (cardName) {
            cardName.textContent = author;
        }
        if (cardMeta) {
            cardMeta.textContent = '文章数：' + totalVisible;
        }
        if (cardAvatar && avatarSrc) {
            cardAvatar.src = avatarSrc;
        }
    } else {
        header.textContent = '暂无作者 “' + author + '” 的文章，已显示全部文章';
        blocks.forEach(function(block) {
            block.style.display = '';
            var items = block.querySelectorAll('.archive-item');
            items.forEach(function(item) {
                item.style.display = '';
            });
        });
        if (card) {
            card.style.display = 'none';
        }
    }
}

function initHeaderMedia() {
    var header = document.querySelector('.moments-header');
    if (!header || !window.amigoConfig) return;
    // 若已包含视频，跳过动态图逻辑
    if (header.querySelector('video.moments-header-video')) return;

    var list = (window.amigoConfig.headerMediaList || []).filter(function(src) {
        return typeof src === 'string' && /\.(avif|jpg|jpeg|png|gif|webp)$/i.test(src);
    });
    var single = window.amigoConfig.headerMedia || '';
    var isImage = /\.(avif|jpg|jpeg|png|gif|webp)$/i.test(single);
    var isVideo = /\.(mp4|webm|ogg)$/i.test(single);

    // 1) 多图轮播（参考：朴素实现）
    if (list.length >= 2 && !isVideo) {
        var dynamic = header.querySelector('.moments-header-dynamic');
        if (!dynamic) {
            dynamic = document.createElement('div');
            dynamic.className = 'moments-header-dynamic';
            header.appendChild(dynamic);
        } else {
            dynamic.innerHTML = '';
        }

        var slides = [];
        list.forEach(function(src, idx) {
            var img = document.createElement('img');
            img.className = 'slide' + (idx === 0 ? ' active' : '');
            img.src = src;
            img.alt = 'header slide';
            img.loading = 'eager';
            dynamic.appendChild(img);
            slides.push(img);
        });

        var i = 0;
        function next() {
            var cur = i;
            var nxt = (i + 1) % slides.length;
            slides[cur].classList.remove('active');
            slides[nxt].classList.add('active');
            i = nxt;
            setTimeout(next, 6000);
        }
        setTimeout(next, 6000);
        return;
    }

    // 2) 单图 Live Photo：同名视频触发播放（mouseenter / touch）
    if (isImage && !isVideo) {
        // 生成同名视频路径（.mp4）
        var videoSrc = single.replace(/\.(avif|jpg|jpeg|png|gif|webp)$/i, '.mp4');
        var video = document.createElement('video');
        video.className = 'moments-header-live';
        video.src = videoSrc;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.loop = true;
        video.preload = 'metadata';
        // 允许声音，因交互触发，不受自动播放限制；如需静音可改为 video.muted = true;
        video.muted = false;

        var available = true;
        video.addEventListener('error', function() {
            available = false;
            if (video && video.parentNode) video.parentNode.removeChild(video);
        }, { once: true });
        video.addEventListener('play', function() {
            video.classList.add('playing');
        });
        video.addEventListener('pause', function() {
            video.classList.remove('playing');
        });

        header.appendChild(video);

        function playLive() {
            if (!available) return;
            // 交互触发播放，带声音
            var p = video.play();
            if (p && typeof p.catch === 'function') {
                p.catch(function() {});
            }
        }
        function stopLive() {
            if (!available) return;
            video.pause();
            try { video.currentTime = 0; } catch(e) {}
        }

        header.addEventListener('mouseenter', playLive);
        header.addEventListener('mouseleave', stopLive);
        header.addEventListener('touchstart', function() {
            playLive();
        }, { passive: true });
        header.addEventListener('touchend', function() {
            stopLive();
        }, { passive: true });
        header.addEventListener('touchcancel', function() {
            stopLive();
        }, { passive: true });
        return;
    }
}

/**
 * 格式化时间显示（微信朋友圈风格）
 * 今天：显示"今天"或具体时间
 * 昨天：显示"昨天"
 * 本周：显示星期几
 * 更早：显示具体日期
 */
function formatMomentTimes() {
    const timeElements = document.querySelectorAll('.moment-time[data-moment-time]');

    timeElements.forEach(el => {
        const timeStr = el.dataset.momentTime;
        if (!timeStr) return;

        const date = new Date(timeStr);
        const now = new Date();

        // 计算时间差
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // 获取今天的日期
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // 判断是否是今天
        const isToday = date >= today;
        // 判断是否是昨天
        const isYesterday = date >= yesterday && date < today;

        // 获取星期几
        const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekDay = weekDays[date.getDay()];

        // 格式化时间
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const timeStr24 = `${hours}:${minutes}`;

        let displayText = '';

        if (isToday) {
            // 今天：显示时间
            displayText = timeStr24;
        } else if (isYesterday) {
            // 昨天：显示"昨天"
            displayText = '昨天';
        } else if (diffDays < 7) {
            // 本周内：显示星期几
            displayText = weekDay;
        } else {
            // 更早：显示具体日期
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const year = date.getFullYear();
            const currentYear = now.getFullYear();

            if (year === currentYear) {
                // 今年：显示月日
                displayText = `${month}月${day}日`;
            } else {
                // 其他年份：显示年月日
                displayText = `${year}年${month}月${day}日`;
            }
        }

        el.textContent = displayText;
    });
}

function initMoments() {
    // 0. 格式化时间显示（微信朋友圈风格）
    formatMomentTimes();

    // 1. Handle Text Expand/Collapse
    const posts = document.querySelectorAll('.moment-card');

    posts.forEach(card => {
        const textWrapper = card.querySelector('.moment-text-wrapper');
        if (!textWrapper) return;

        const textDiv = textWrapper.querySelector('.moment-text');
        const toggleBtn = textWrapper.querySelector('.text-toggle');

        if (textDiv && toggleBtn) {
            // 检测实况照片、音乐卡片和视频，有的话取消折叠
            const motionPhotos = textDiv.querySelectorAll('.live-photo-container');
            const musicCards = textDiv.querySelectorAll('.amigo-music-card-mark');
            const videoContainers = textDiv.querySelectorAll('.amigo-video-container');

            // 清理旧状态
            textDiv.classList.remove('has-motion-photos', 'has-music-card', 'has-video', 'has-voice');
            textWrapper.classList.remove('has-motion-photos', 'has-music-card', 'has-video', 'has-voice');
            textDiv.removeAttribute('data-motion-count');

            if (motionPhotos.length) {
                textDiv.classList.add('has-motion-photos');
                textWrapper.classList.add('has-motion-photos');
                textDiv.dataset.motionCount = String(motionPhotos.length);

                // 列表页点击实况照片 → 灯箱弹窗播放
                const isSingle = document.querySelector('.moments-feed.single-view') !== null;
                if (!isSingle) {
                    const motionGroup = Array.prototype.slice.call(motionPhotos);
                    motionPhotos.forEach(el => {
                        if (!el._motionClickBound) {
                            el._motionClickBound = true;
                            el.addEventListener('click', function(e) {
                                if (e.target.closest('.live-photo-control-btn')) return;
                                e.preventDefault();
                                e.stopPropagation();
                                openLivePhotoLightbox(el, motionGroup);
                            });
                        }
                    });
                }

                const cols = (motionPhotos.length === 2 || motionPhotos.length === 4) ? 2 : Math.min(motionPhotos.length, 3);
                const colsMd = Math.min(motionPhotos.length, 2);
                const colsSm = 1;
                textDiv.style.setProperty('--motion-photo-columns', String(cols));
                textDiv.style.setProperty('--motion-photo-columns-md', String(colsMd));
                textDiv.style.setProperty('--motion-photo-columns-sm', String(colsSm));
            }

            if (musicCards.length) {
                textDiv.classList.add('has-music-card');
                textWrapper.classList.add('has-music-card');
            }

            if (videoContainers.length) {
                textDiv.classList.add('has-video');
                textWrapper.classList.add('has-video');
            }

            const voiceMsgs = textDiv.querySelectorAll('.amigo-voice-bubble');
            if (voiceMsgs.length) {
                textDiv.classList.add('has-voice');
                textWrapper.classList.add('has-voice');
            }

            // Reset state for re-init
            textDiv.classList.add('is-collapsed');
            toggleBtn.style.display = 'none';
            toggleBtn.innerText = '全文';

            // 如果有实况照片、音乐卡片、视频或语音，不需要折叠
            const hasSpecialContent = motionPhotos.length > 0 || musicCards.length > 0 || videoContainers.length > 0 || voiceMsgs.length > 0;

            // Check overflow after a small delay to ensure rendering
            setTimeout(() => {
                if (hasSpecialContent) {
                    // 有特殊内容时不显示全文按钮
                    toggleBtn.style.display = 'none';
                } else {
                    const isOverflowing = textDiv.scrollHeight > textDiv.clientHeight;
                    if (isOverflowing) {
                        toggleBtn.style.display = 'inline-block';
                    }
                }
            }, 100);

            // Toggle Click Handler
            toggleBtn.onclick = function() {
                const isCollapsed = textDiv.classList.contains('is-collapsed');
                if (isCollapsed) {
                    textDiv.classList.remove('is-collapsed');
                    toggleBtn.innerText = '收起';
                } else {
                    textDiv.classList.add('is-collapsed');
                    toggleBtn.innerText = '全文';
                    // Scroll back to card top if user collapsed a long text
                    const cardTop = card.getBoundingClientRect().top + window.scrollY - 80;
                    if (window.scrollY > cardTop) {
                        window.scrollTo({ top: cardTop, behavior: 'smooth' });
                    }
                }
            };
        }
    });

}

/* ==========================================================================
   紧凑音乐卡片播放器 (music-card)
   ========================================================================== */

class MusicCardPlayer {
    constructor(container, attachOnly) {
        this.container = container;
        this.isPlaying = false;
        this.isSeeking = false;

        this.src = container.dataset.src;
        this.name = container.dataset.name;
        this.artist = container.dataset.artist;
        this.isApi = container.dataset.isApi === 'true';

        this.audio = AudioManager.audio;
        this.playBtn = container.querySelector('.amigo-music-card__play');
        this.seekInput = container.querySelector('.amigo-music-card__seek');
        this.seekThumb = container.querySelector('.amigo-music-card__seek-thumb');
        this.seekWrap = container.querySelector('.amigo-music-card__seek-wrap');
        this.timeCurrent = container.querySelector('.amigo-music-card__time--current');
        this.timeDuration = container.querySelector('.amigo-music-card__time--duration');

        if (!attachOnly) {
            if (this.isApi && this.src) {
                this.fetchAndSetAudioUrl(this.src);
            } else if (this.src) {
                AudioManager.load(this.src);
            }
        }

        this.bindEvents();
        AudioManager.attach(this);

        // 如果正在播放，同步 UI
        if (AudioManager.isPlaying) {
            this.syncUI();
        }
    }

    async fetchAndSetAudioUrl(apiUrl) {
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.url) {
                AudioManager.load(data.url);
            }
        } catch (e) {
            console.error('获取音频URL失败:', e);
        }
    }

    bindEvents() {
        if (this.playBtn) {
            this.playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlay();
            });
        }

        const art = this.container.querySelector('.amigo-music-card__art');
        if (art) {
            art.addEventListener('click', () => this.togglePlay());
        }

        if (this.seekInput) {
            this.seekInput.addEventListener('input', (e) => {
                this.isSeeking = true;
                this.updateSeekVisual(e.target.value / 1000);
            });
            this.seekInput.addEventListener('change', (e) => {
                if (this.audio && this.audio.duration) {
                    this.audio.currentTime = (e.target.value / 1000) * this.audio.duration;
                }
                this.isSeeking = false;
            });
        }

        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
        this.audio.addEventListener('ended', () => this.onEnded());
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());
    }

    syncUI() {
        this.isPlaying = true;
        this.container.setAttribute('data-playing', 'true');
        if (this.playBtn) this.playBtn.setAttribute('aria-pressed', 'true');
        if (this.audio.duration) {
            this.onLoadedMetadata();
            this.onTimeUpdate();
        }
    }

    togglePlay() {
        if (!this.audio) return;
        if (this.isPlaying) {
            AudioManager.pause();
        } else {
            AudioManager.play();
        }
    }

    onPlay() {
        this.isPlaying = true;
        this.container.setAttribute('data-playing', 'true');
        if (this.playBtn) this.playBtn.setAttribute('aria-pressed', 'true');
    }

    onPause() {
        this.isPlaying = false;
        this.container.setAttribute('data-playing', 'false');
        if (this.playBtn) this.playBtn.setAttribute('aria-pressed', 'false');
    }

    onEnded() {
        this.isPlaying = false;
        this.container.setAttribute('data-playing', 'false');
        if (this.playBtn) this.playBtn.setAttribute('aria-pressed', 'false');
        this.audio.currentTime = 0;
        this.updateSeekVisual(0);
    }

    onTimeUpdate() {
        if (this.isSeeking || !this.audio || !this.audio.duration) return;
        const progress = this.audio.currentTime / this.audio.duration;
        this.updateSeekVisual(progress);
        if (this.timeCurrent) {
            this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    onLoadedMetadata() {
        if (this.timeDuration && this.audio) {
            this.timeDuration.textContent = this.formatTime(this.audio.duration);
        }
    }

    updateSeekVisual(progress) {
        const pct = Math.max(0, Math.min(1, progress)) * 100;
        this.container.style.setProperty('--music-progress', pct + '%');
        if (this.seekInput) this.seekInput.value = Math.round(progress * 1000);
        if (this.timeCurrent && this.audio && this.audio.duration) {
            this.timeCurrent.textContent = this.formatTime(progress * this.audio.duration);
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
}

function initMusicCardPlayers() {
    const cards = document.querySelectorAll('.amigo-music-card[data-amigo-music-card]');
    cards.forEach(card => {
        if (!card.dataset.cardInit) {
            new MusicCardPlayer(card);
            card.dataset.cardInit = 'true';
        }
    });
}

// PJAX 切换后，将正在播放的音乐关联到新页面的播放器 UI
function attachPlayingMusicPlayer() {
    // 尝试关联 music-card
    const card = document.querySelector('.amigo-music-card[data-amigo-music-card]');
    if (card) {
        new MusicCardPlayer(card, true);
        card.dataset.cardInit = 'true';
        return;
    }
    // 尝试关联 music-player
    const player = document.querySelector('.music-player');
    if (player) {
        new MusicPlayer(player, true);
        player.dataset.musicInit = 'true';
    }
}

/* ==========================================================================
   视频播放器功能 (video shortcode)
   ========================================================================== */

function initVideoPlayers() {
    document.querySelectorAll('.amigo-video-container:not(.amigo-video-bilibili)').forEach(container => {
        if (container.dataset.videoInit) return;
        container.dataset.videoInit = 'true';

        const video = container.querySelector('.amigo-video');
        const playBtn = container.querySelector('.amigo-video-play-btn');
        const muteBtn = container.querySelector('.amigo-video-mute-btn');
        const fullscreenBtn = container.querySelector('.amigo-video-fullscreen-btn');
        const progressBar = container.querySelector('.amigo-video-progress');
        const progressFill = container.querySelector('.amigo-video-progress-bar');
        const timeEl = container.querySelector('.amigo-video-time');

        if (!video) return;

        const formatTime = (s) => {
            if (!s || isNaN(s)) return '0:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        };

        const updatePlayIcon = () => {
            const icon = playBtn.querySelector('i');
            icon.className = video.paused ? 'ri-play-fill' : 'ri-pause-fill';
        };

        // 点击容器播放/暂停
        container.addEventListener('click', (e) => {
            if (e.target.closest('.amigo-video-controls')) return;
            video.paused ? video.play() : video.pause();
        });

        // 播放按钮
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.paused ? video.play() : video.pause();
        });

        video.addEventListener('play', updatePlayIcon);
        video.addEventListener('pause', updatePlayIcon);
        video.addEventListener('ended', () => {
            updatePlayIcon();
            progressFill.style.width = '0';
        });

        // 进度条
        video.addEventListener('timeupdate', () => {
            if (!video.duration) return;
            const pct = (video.currentTime / video.duration) * 100;
            progressFill.style.width = pct + '%';
            timeEl.textContent = formatTime(video.currentTime);
        });

        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = progressBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            video.currentTime = pct * video.duration;
        });

        // 静音
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            muteBtn.querySelector('.ri-volume-up-line').style.display = video.muted ? 'none' : '';
            muteBtn.querySelector('.ri-volume-mute-line').style.display = video.muted ? '' : 'none';
        });

        // 全屏
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                container.requestFullscreen().catch(() => {});
            }
        });
    });
}

/* ==========================================================================
   微信语音消息功能 (voice shortcode)
   ========================================================================== */

function initVoiceMessages() {
    document.querySelectorAll('.amigo-voice-bubble').forEach(el => {
        if (el.dataset.voiceInit) return;
        el.dataset.voiceInit = 'true';

        const src = el.dataset.src;
        if (!src) return;

        const durationEl = el.querySelector('.amigo-voice-duration');
        let audio = null;
        let isPlaying = false;

        // 立即加载音频获取真实时长
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.addEventListener('loadedmetadata', () => {
            if (probe.duration && !isNaN(probe.duration)) {
                durationEl.textContent = Math.round(probe.duration) + '″';
            }
        });
        probe.src = src;

        const stop = () => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            isPlaying = false;
            el.classList.remove('is-playing');
        };

        el.addEventListener('click', () => {
            if (!audio) {
                audio = new Audio(src);
                audio.addEventListener('ended', stop);
            }

            if (isPlaying) {
                stop();
            } else {
                document.querySelectorAll('.amigo-voice-bubble.is-playing').forEach(other => {
                    if (other !== el) {
                        other.classList.remove('is-playing');
                        if (other._voiceAudio) {
                            other._voiceAudio.pause();
                            other._voiceAudio.currentTime = 0;
                        }
                    }
                });
                audio.play().catch(() => {});
                isPlaying = true;
                el.classList.add('is-playing');
                el._voiceAudio = audio;
            }
        });
    });
}

/* ==========================================================================
   Motion Photo 实况照片功能
   ========================================================================== */

class MotionPhoto {
    constructor(container, isSingleView) {
        this.container = container;
        this.video = container.querySelector('.live-photo-video');
        this.poster = container.querySelector('.live-photo-poster');
        this.toggleBtn = container.querySelector('.live-photo-toggle-btn');
        this.muteBtn = container.querySelector('.live-photo-mute-btn');
        this.isSingleView = isSingleView || false;

        this.isPlaying = false;
        this.isMuted = true;
        this.isLocked = false;
        this.playToken = 0;
        this.resetTimer = null;

        this.hoverDelay = parseInt(container.dataset.hoverDelay) || 500;
        this.hoverTimer = null;
        this.touchActivated = false;

        this.videoLoaded = false;

        this.syncAspectFromPoster();
        this.syncControls();
        this.bindEvents();
    }

    syncAspectFromPoster() {
        if (!this.poster) return;
        const apply = () => {
            const w = this.poster.naturalWidth || 0;
            const h = this.poster.naturalHeight || 0;
            if (!w || !h) return;
            this.container.style.setProperty('--live-photo-aspect', `${w} / ${h}`);
        };

        if (this.poster.complete) apply();
        else this.poster.addEventListener('load', apply, { once: true });
    }

    loadVideo() {
        if (!this.video) return;
        const dataSrc = this.video.dataset.src;
        if (dataSrc && !this.video.src) {
            this.video.src = dataSrc;
            try { this.video.load(); } catch (e) {}
        }
        this.video.preload = 'auto';
        this.videoLoaded = true;
    }

    waitUntilReady() {
        if (!this.video || this.video.readyState >= 2) return Promise.resolve();
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                this.video.removeEventListener('canplay', finish);
                this.video.removeEventListener('loadeddata', finish);
                resolve();
            };
            this.video.addEventListener('canplay', finish, { once: true });
            this.video.addEventListener('loadeddata', finish, { once: true });
            setTimeout(finish, 700);
        });
    }

    bindEvents() {
        if (this.isSingleView) {
            this.container.addEventListener('mouseenter', () => {
                if (this.isLocked) return;
                this.loadVideo();
                clearTimeout(this.hoverTimer);
                this.hoverTimer = setTimeout(() => {
                    this.play();
                }, this.hoverDelay);
            });

            this.container.addEventListener('mouseleave', () => {
                clearTimeout(this.hoverTimer);
                if (this.isLocked) return;
                this.pause();
            });

            this.container.addEventListener('touchstart', (e) => {
                if (e.target.closest('.live-photo-control-btn')) return;
                if (this.isLocked) return;
                clearTimeout(this.hoverTimer);
                this.touchActivated = true;
                this.loadVideo();
                this.play();
            }, { passive: true });

            this.container.addEventListener('touchend', () => {
                if (this.isLocked) return;
                clearTimeout(this.hoverTimer);
            }, { passive: true });
        }

        // LIVE 按钮切换锁定
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isLocked = !this.isLocked;
                if (this.isLocked) {
                    this.play();
                } else {
                    this.pause();
                }
                this.syncControls();
            });
        }

        // 静音按钮
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }

        // 视频事件
        if (this.video) {
            this.video.muted = this.isMuted;
            this.video.playsInline = true;
            this.video.setAttribute('playsinline', '');

            this.video.addEventListener('play', () => {
                this.isPlaying = true;
                this.syncControls();
            });
            this.video.addEventListener('pause', () => {
                this.isPlaying = false;
                this.syncControls();
            });
            this.video.addEventListener('ended', () => {
                this.isPlaying = false;
                if (!this.isLocked) {
                    this.video.currentTime = 0;
                    this.container.classList.remove('is-playing');
                }
                this.syncControls();
            });
        }

        // 详情页点击容器切换播放/暂停
        if (this.isSingleView) {
            this.container.addEventListener('click', (e) => {
                if (e.target.closest('.live-photo-control-btn')) return;
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            });
        }
    }

    async play() {
        if (!this.video) return false;
        if (this.isPlaying) return true;
        const token = ++this.playToken;
        clearTimeout(this.resetTimer);
        this.loadVideo();

        try {
            if (this.video.currentTime > 0.08) this.video.currentTime = 0;
        } catch (e) {}

        await this.waitUntilReady();
        if (token !== this.playToken) return false;

        try {
            await this.video.play();
            if (token !== this.playToken) return false;
            requestAnimationFrame(() => {
                if (token === this.playToken) this.container.classList.add('is-playing');
            });
            return true;
        } catch (e) {
            this.container.classList.remove('is-playing');
            return false;
        }
    }

    pause() {
        if (!this.video || !this.isPlaying) return;
        this.playToken++;
        clearTimeout(this.hoverTimer);
        clearTimeout(this.resetTimer);
        this.container.classList.remove('is-playing');
        this.video.pause();
        this.resetTimer = setTimeout(() => {
            try { this.video.currentTime = 0; } catch (e) {}
        }, 180);
    }

    toggleMute() {
        if (!this.video) return;
        this.isMuted = !this.isMuted;
        this.video.muted = this.isMuted;
        if (this.muteBtn) {
            this.muteBtn.dataset.muted = this.isMuted.toString();
        }
        this.syncControls();
    }

    syncControls() {
        if (this.toggleBtn) {
            const state = this.isLocked || this.isPlaying ? 'live' : 'static';
            this.toggleBtn.dataset.state = state;
            this.toggleBtn.setAttribute('aria-pressed', this.isLocked ? 'true' : 'false');
        }
        if (this.muteBtn) {
            this.muteBtn.dataset.muted = this.isMuted.toString();
            this.muteBtn.setAttribute('aria-pressed', (!this.isMuted).toString());
        }
    }
}

function initMotionPhotos() {
    const isSingleView = document.querySelector('.moments-feed.single-view') !== null;
    const containers = document.querySelectorAll('.live-photo-container');
    containers.forEach(container => {
        if (!container.dataset.motionInit) {
            const mp = new MotionPhoto(container, isSingleView);
            container.dataset.motionInit = 'true';
            if (isSingleView) {
                mp.loadVideo();
            }
        }
    });
}

var livePhotoLightboxCleanup = null;

function openLivePhotoLightbox(originalEl, groupEls) {
    closeLivePhotoLightbox();

    var items = Array.isArray(groupEls) && groupEls.length ? groupEls : [originalEl];
    var currentIndex = Math.max(0, items.indexOf(originalEl));
    var activeMotion = null;
    var activeClone = null;
    var isSwitching = false;

    var lightbox = document.createElement('div');
    lightbox.className = 'live-photo-lightbox';

    var stage = document.createElement('div');
    stage.className = 'live-photo-lightbox-stage';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.innerHTML = '<i class="ri-close-line"></i>';
    closeBtn.setAttribute('aria-label', '关闭');
    lightbox.appendChild(closeBtn);

    var tools = document.createElement('div');
    tools.className = 'live-photo-lightbox-tools';

    var count = document.createElement('div');
    count.className = 'live-photo-lightbox-count';
    tools.appendChild(count);

    var nav = document.createElement('div');
    nav.className = 'live-photo-lightbox-nav';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'live-photo-lightbox-btn live-photo-lightbox-prev';
    prevBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i>';
    prevBtn.setAttribute('aria-label', '上一张');

    var nextBtn = document.createElement('button');
    nextBtn.className = 'live-photo-lightbox-btn live-photo-lightbox-next';
    nextBtn.innerHTML = '<i class="ri-arrow-right-s-line"></i>';
    nextBtn.setAttribute('aria-label', '下一张');

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    tools.appendChild(nav);

    lightbox.appendChild(stage);
    lightbox.appendChild(tools);
    document.body.appendChild(lightbox);

    document.body.style.overflow = 'hidden';

    function prepareClone(sourceEl, direction) {
        var clone = sourceEl.cloneNode(true);
        clone.removeAttribute('style');
        clone.dataset.motionInit = 'false';
        clone.classList.add('lightbox-clone');
        clone.classList.add(direction === 'prev' ? 'lightbox-enter-prev' : 'lightbox-enter-next');

        var posterEl = clone.querySelector('.live-photo-poster');
        var originalPoster = sourceEl.querySelector('.live-photo-poster');
        if (posterEl) {
            posterEl.setAttribute('no-view', '');
        }

        var ratioWidth = originalPoster && originalPoster.naturalWidth ? originalPoster.naturalWidth : 0;
        var ratioHeight = originalPoster && originalPoster.naturalHeight ? originalPoster.naturalHeight : 0;
        if (!ratioWidth || !ratioHeight) {
            var rect = sourceEl.getBoundingClientRect();
            ratioWidth = rect.width || 4;
            ratioHeight = rect.height || 5;
        }
        clone.style.setProperty('--live-photo-aspect', ratioWidth + ' / ' + ratioHeight);
        clone.style.setProperty('--live-photo-ratio', String(ratioWidth / ratioHeight));

        var videoEl = clone.querySelector('.live-photo-video');
        function showPoster() {
            clone.classList.remove('is-playing');
            if (videoEl) videoEl.style.opacity = '0';
            if (posterEl) posterEl.style.opacity = '1';
        }

        if (videoEl) {
            var src = videoEl.dataset.src;
            if (src) {
                videoEl.src = src;
                videoEl.setAttribute('src', src);
                videoEl.load();
            } else {
                showPoster();
            }
            videoEl.addEventListener('error', showPoster, { once: true });
            videoEl.style.cssText = 'display:block;position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;opacity:0;z-index:1;border-radius:12px';
        }

        return { clone, showPoster };
    }

    function stopActive() {
        if (activeMotion) activeMotion.pause();
        if (activeClone) {
            var video = activeClone.querySelector('.live-photo-video');
            if (video) {
                try {
                    video.pause();
                    video.currentTime = 0;
                } catch (e) {}
            }
        }
    }

    function updateTools() {
        count.innerHTML = '<b>' + (currentIndex + 1) + '</b>/' + items.length;
        var multiple = items.length > 1;
        tools.style.display = multiple ? 'flex' : 'none';
    }

    function showItem(index, direction) {
        if (isSwitching || !items.length) return;
        isSwitching = true;
        stopActive();

        currentIndex = (index + items.length) % items.length;
        updateTools();

        var prepared = prepareClone(items[currentIndex], direction || 'next');
        var clone = prepared.clone;
        var oldClone = activeClone;

        stage.appendChild(clone);
        activeClone = clone;

        requestAnimationFrame(function() {
            clone.classList.remove('lightbox-enter-prev', 'lightbox-enter-next');
            clone.classList.add('lightbox-active');
            if (oldClone) {
                oldClone.classList.remove('lightbox-active');
                oldClone.classList.add(direction === 'prev' ? 'lightbox-exit-next' : 'lightbox-exit-prev');
            }
        });

        activeMotion = new MotionPhoto(clone, true);
        clone.dataset.motionInit = 'true';
        activeMotion.loadVideo();

        setTimeout(function() {
            activeMotion.play().then(function(ok) {
                var v = clone.querySelector('.live-photo-video');
                if (ok && v && !v.error) {
                    v.style.opacity = '1';
                } else {
                    prepared.showPoster();
                }
            }).catch(prepared.showPoster);
        }, 180);

        setTimeout(function() {
            if (oldClone && oldClone.parentNode) oldClone.parentNode.removeChild(oldClone);
            isSwitching = false;
        }, 260);
    }

    function goPrev() {
        showItem(currentIndex - 1, 'prev');
    }

    function goNext() {
        showItem(currentIndex + 1, 'next');
    }

    showItem(currentIndex, 'next');

    function closeFn() {
        lightbox.classList.add('live-lightbox-out');
        setTimeout(function() {
            if (livePhotoLightboxCleanup) livePhotoLightboxCleanup();
            if (lightbox.parentNode) lightbox.parentNode.removeChild(lightbox);
        }, 250);
    }

    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeFn();
    });

    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeFn();
    });

    prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        goPrev();
    });

    nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        goNext();
    });

    var escHandler = function(e) {
        if (e.key === 'Escape') {
            closeFn();
        } else if (e.key === 'ArrowLeft' && items.length > 1) {
            goPrev();
        } else if (e.key === 'ArrowRight' && items.length > 1) {
            goNext();
        }
    };
    document.addEventListener('keydown', escHandler);

    livePhotoLightboxCleanup = function() {
        stopActive();
        document.removeEventListener('keydown', escHandler);
        document.body.style.overflow = '';
        livePhotoLightboxCleanup = null;
    };
}

function closeLivePhotoLightbox() {
    var existing = document.querySelector('.live-photo-lightbox');
    if (livePhotoLightboxCleanup) livePhotoLightboxCleanup();
    if (existing) {
        existing.parentNode.removeChild(existing);
    }
    document.body.style.overflow = '';
}

function initHomeFloatingBar() {
    var floatingBar = document.getElementById('home-floating-bar');
    if (!floatingBar) return;

    var searchContainer = document.getElementById('header-search');
    if (searchContainer) {
        floatingBar.appendChild(searchContainer);
    }

    var themeToggle = document.querySelector('.home-header .theme-toggle');
    if (themeToggle) {
        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'floating-actions';
        actionsDiv.appendChild(themeToggle);
        floatingBar.appendChild(actionsDiv);
    }

    floatingBar.style.display = 'flex';
}

/* ==========================================================================
   音乐播放器功能
   ========================================================================== */

class MusicPlayer {
    constructor(container, attachOnly) {
        this.container = container;
        this.audio = AudioManager.audio;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this._attachOnly = attachOnly;

        this.init();
    }

    init() {
        this.src = this.container.dataset.src;
        this.cover = this.container.dataset.cover;
        this.name = this.container.dataset.name;
        this.artist = this.container.dataset.artist;

        // 检查是否有播放列表
        const playlistEl = this.container.querySelector('.music-playlist');
        if (playlistEl) {
            try {
                this.playlist = JSON.parse(playlistEl.textContent);
                if (this.playlist.length > 0) {
                    this.src = this.playlist[0].src;
                    this.cover = this.playlist[0].cover;
                    this.name = this.playlist[0].name;
                    this.artist = this.playlist[0].artist;
                }
            } catch (e) {
                console.error('播放列表解析失败:', e);
            }
        } else if (this.src) {
            this.playlist = [{
                src: this.src,
                cover: this.cover,
                name: this.name,
                artist: this.artist
            }];
        }

        // 获取DOM元素
        this.coverImg = this.container.querySelector('.music-cover');
        this.nameEl = this.container.querySelector('.music-name');
        this.artistEl = this.container.querySelector('.music-artist');
        this.progressCurrent = this.container.querySelector('.music-progress-current');
        this.timeCurrent = this.container.querySelector('.music-time-current');
        this.timeTotal = this.container.querySelector('.music-time-total');
        this.progressBar = this.container.querySelector('.music-progress-bar');

        this.playBtns = [
            this.container.querySelector('.music-btn-play'),
            this.container.querySelector('.music-btn-play-main')
        ].filter(Boolean);

        this.prevBtn = this.container.querySelector('.music-btn-prev');
        this.nextBtn = this.container.querySelector('.music-btn-next');

        this.bindEvents();
        AudioManager.attach(this);

        if (this._attachOnly && AudioManager.isPlaying) {
            // 正在播放，只同步 UI
            this.syncUI();
        } else if (this.src) {
            this.loadTrack(this.src);
        }
    }

    syncUI() {
        this.isPlaying = true;
        this.container.classList.add('playing');
        this.updatePlayButton();
        if (this.audio.duration) {
            this.updateDuration();
            this.updateProgress();
        }
    }

    bindEvents() {
        this.playBtns.forEach(btn => {
            btn.addEventListener('click', () => this.togglePlay());
        });

        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prev());
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.next());
        }

        if (this.progressBar) {
            this.progressBar.addEventListener('click', (e) => {
                const rect = this.progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.audio.currentTime = percent * this.audio.duration;
            });
        }

        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.onTrackEnd());
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());
    }

    loadTrack(src) {
        AudioManager.load(src);
    }

    togglePlay() {
        if (this.isPlaying) {
            AudioManager.pause();
        } else {
            AudioManager.play();
        }
    }

    prev() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.updateTrack();
        this.play();
    }

    next() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.updateTrack();
        this.play();
    }

    updateTrack() {
        const track = this.playlist[this.currentIndex];
        if (!track) return;

        this.src = track.src;
        this.cover = track.cover;
        this.name = track.name;
        this.artist = track.artist;

        if (this.coverImg) this.coverImg.src = this.cover;
        if (this.nameEl) this.nameEl.textContent = this.name;
        if (this.artistEl) this.artistEl.textContent = this.artist;

        this.loadTrack(this.src);
    }

    updateProgress() {
        if (this.audio.duration) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            if (this.progressCurrent) this.progressCurrent.style.width = percent + '%';
            if (this.timeCurrent) this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateDuration() {
        if (this.timeTotal) this.timeTotal.textContent = this.formatTime(this.audio.duration);
    }

    onTrackEnd() {
        if (this.playlist.length > 1) {
            this.next();
        } else {
            this.isPlaying = false;
            this.container.classList.remove('playing');
            this.updatePlayButton();
        }
    }

    onPlay() {
        this.isPlaying = true;
        this.container.classList.add('playing');
        this.updatePlayButton();
    }

    onPause() {
        this.isPlaying = false;
        this.container.classList.remove('playing');
        this.updatePlayButton();
    }

    updatePlayButton() {
        const icon = this.isPlaying ? 'ri-pause-fill' : 'ri-play-fill';
        this.playBtns.forEach(btn => {
            const i = btn.querySelector('i');
            if (i) i.className = icon;
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
}

function initMusicPlayers() {
    const players = document.querySelectorAll('.music-player');
    players.forEach(player => {
        if (!player.dataset.musicInit) {
            new MusicPlayer(player);
            player.dataset.musicInit = 'true';
        }
    });
}

/* ==========================================================================
   精美 Live 动图卡片功能
   ========================================================================== */

class LivePhotoCard {
    constructor(container) {
        this.container = container;
        this.isPlaying = false;
        this.isMuted = true;

        this.init();
    }

    init() {
        this.src = this.container.dataset.src;
        this.videoSrc = this.container.dataset.video;

        this.video = this.container.querySelector('.live-card-video');
        this.playBtn = this.container.querySelector('.live-card-play-btn');
        this.volumeBtn = this.container.querySelector('.live-card-volume');
        this.loopBtn = this.container.querySelector('.live-card-loop');
        this.progressBar = this.container.querySelector('.live-card-progress-bar');

        this.volumeIcons = this.volumeBtn ? {
            up: this.volumeBtn.querySelector('.ri-volume-up-line'),
            mute: this.volumeBtn.querySelector('.ri-volume-mute-line')
        } : null;

        this.bindEvents();

        if (this.video) {
            this.video.muted = true;
        }
    }

    bindEvents() {
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.togglePlay());
        }

        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.live-card-controls') || e.target.closest('.live-card-play-btn')) {
                return;
            }
            this.togglePlay();
        });

        if (this.volumeBtn) {
            this.volumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }

        if (this.loopBtn) {
            this.loopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLoop();
            });
        }

        if (this.video) {
            this.video.addEventListener('timeupdate', () => this.updateProgress());
            this.video.addEventListener('ended', () => this.onVideoEnd());
            this.video.addEventListener('play', () => this.onPlay());
            this.video.addEventListener('pause', () => this.onPause());
        }
    }

    togglePlay() {
        if (!this.video) return;

        if (this.isPlaying) {
            this.video.pause();
        } else {
            this.video.currentTime = 0;
            this.video.play().catch(e => console.error('播放失败:', e));
        }
    }

    toggleMute() {
        if (!this.video) return;

        this.isMuted = !this.isMuted;
        this.video.muted = this.isMuted;

        if (this.volumeIcons) {
            this.volumeIcons.up.style.display = this.isMuted ? 'none' : 'block';
            this.volumeIcons.mute.style.display = this.isMuted ? 'block' : 'none';
        }
    }

    toggleLoop() {
        if (!this.video) return;

        const isLoop = this.video.loop;
        this.video.loop = !isLoop;

        if (this.loopBtn) {
            this.loopBtn.dataset.loop = (!isLoop).toString();
            this.loopBtn.style.color = !isLoop ? 'var(--theme-color)' : 'white';
        }
    }

    updateProgress() {
        if (this.video && this.progressBar && this.video.duration) {
            const percent = (this.video.currentTime / this.video.duration) * 100;
            this.progressBar.style.width = percent + '%';
        }
    }

    onVideoEnd() {
        this.isPlaying = false;
        this.container.classList.remove('playing');
    }

    onPlay() {
        this.isPlaying = true;
        this.container.classList.add('playing');
    }

    onPause() {
        this.isPlaying = false;
        this.container.classList.remove('playing');
    }
}

function initLivePhotoCards() {
    const cards = document.querySelectorAll('.live-card');
    cards.forEach(card => {
        if (!card.dataset.liveInit) {
            new LivePhotoCard(card);
            card.dataset.liveInit = 'true';
        }
    });
}
