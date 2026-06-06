# Amigo 朋友圈风格 Hugo 站点

Amigo 是一个朋友圈风格的 Hugo 站点，仓库内已经包含：

- Hugo 主题页面
- Vue 管理后台
- Node.js / Express API 服务
- 图片、视频、音乐等媒体上传管理
- 一键部署和一键卸载脚本

适合部署成个人动态站点：前台展示朋友圈式信息流，后台用于发布文章、上传媒体、修改站点配置。

## 功能

- 朋友圈式信息流和九宫格图片布局
- 长文章卡片展示
- 图片、视频、音乐、语音、实况照片短代码
- PJAX、图片灯箱、深色模式
- 管理后台发布、编辑、删除、置顶文章
- 媒体库上传和删除文件
- 站点基础配置在线修改
- systemd + Nginx 一键部署

## 一键部署

推荐使用全新的 Linux 服务器：

- Ubuntu 20.04+
- Debian 11+
- Rocky Linux 8+
- AlmaLinux 8+
- CentOS Stream 8+

服务器需要能访问公网，因为脚本会下载系统包、Node.js、Hugo 和 npm 依赖。

进入项目目录后执行：

```bash
bash deploy.sh
```

脚本会自动完成：

- 安装系统依赖、Node.js 20、Hugo extended、Nginx
- 复制项目到 `/opt/amigo`
- 生成后台账号、密码和 JWT 密钥
- 安装依赖并构建管理后台和 Hugo 静态站点
- 创建 `amigo` systemd 服务
- 配置 Nginx 反向代理
- 记录安装清单，供卸载时清理

默认访问：

```text
http://服务器IP/
http://服务器IP/admin
```

部署结束时会输出后台账号和密码。

## 常用部署参数

绑定域名：

```bash
DOMAIN=example.com bash deploy.sh
```

自定义后台账号密码：

```bash
ADMIN_USERNAME=myadmin ADMIN_PASSWORD='my-strong-password' bash deploy.sh
```

自定义端口或部署目录：

```bash
PORT=4000 INSTALL_DIR=/srv/amigo bash deploy.sh
```

Nginx 默认仍监听 80 端口，对外访问不需要带后端端口。

## 一键卸载

部署成功后执行：

```bash
bash /opt/amigo/uninstall.sh
```

卸载会清理：

- `amigo` systemd 服务
- `amigo` 系统用户
- `/opt/amigo` 部署目录
- `/var/lib/amigo` 安装清单
- Amigo 的 Nginx 配置
- 脚本为 Amigo 添加的防火墙 80 端口规则
- 脚本为 Amigo 新安装的 Hugo、Node.js、Nginx 和基础依赖

卸载脚本只会删除安装清单中记录为 Amigo 新安装的系统组件，不会误删服务器原本已有的 Node.js、Hugo 或 Nginx。

## 重复部署

可以重复执行：

```bash
bash deploy.sh
```

重复部署会覆盖程序代码并重启服务，但会保留运行数据：

- `/opt/amigo/content`
- `/opt/amigo/static`
- `/opt/amigo/server/.env`
- `/opt/amigo/server/data`

后台上传的媒体、文章和账号密码不会被覆盖。

## 后台使用

后台地址：

```text
http://服务器IP/admin
```

后台可以完成：

- 发布普通动态
- 保存草稿
- 编辑和删除文章
- 置顶文章
- 上传图片、视频、音乐、语音
- 插入短代码
- 修改头像、昵称、站点标题、封面媒体等配置

后台账号密码保存在：

```text
/opt/amigo/server/.env
```

## 常用命令

查看服务状态：

```bash
systemctl status amigo
```

查看日志：

```bash
journalctl -u amigo -f
```

重启服务：

```bash
systemctl restart amigo
```

重新构建 Hugo：

```bash
cd /opt/amigo
hugo --minify
systemctl restart amigo
```

查看后台配置：

```bash
cat /opt/amigo/server/.env
```

## 目录结构

```text
/opt/amigo
├── admin/dist              # 管理后台构建产物
├── content/posts           # 文章内容
├── public                  # Hugo 构建产物
├── server/.env             # 后台账号、密码、端口、JWT 密钥
├── server/data             # 后台文章索引
├── static                  # 图片、视频、音乐等静态资源
├── deploy.sh               # 部署脚本
└── uninstall.sh            # 卸载脚本
```

开发目录：

```text
admin/      # Vue 管理后台
assets/     # Hugo 主题 CSS/JS
content/    # 本地文章内容
layouts/    # Hugo 模板
server/     # Express API 服务
static/     # 静态资源
```

## 文章格式

普通动态：

```markdown
---
title: "周末去爬山"
date: 2026-02-20
author: "Vaica"
location: "武汉·东湖"
tags: ["生活", "摄影"]
images:
  - "/images/posts/photo1.jpg"
  - "/images/posts/photo2.jpg"
---

今天天气真好。
```

长文章：

```markdown
---
title: "我的长文章"
isLongArticle: true
cover: "/images/posts/cover.jpg"
---

正文内容...
```

## 短代码

音乐卡片：

```markdown
{{< music-card src="/music/song.mp3" cover="/images/cover.jpg" name="歌曲名" artist="艺术家" >}}
```

视频：

```markdown
{{< video src="/videos/demo.mp4" poster="/images/poster.jpg" ratio="16/9" >}}
```

语音：

```markdown
{{< voice src="/voice/audio.mp3" duration="12" >}}
```

实况照片：

```markdown
{{< motion-photo image="/livephoto/photo.jpg" video="/livephoto/photo.mp4" ratio="3/4" >}}
```

## 故障排查

访问不到站点：

```bash
systemctl status amigo
nginx -t
systemctl status nginx
```

云服务器还需要在云厂商安全组放行 80 端口。

后台打不开时，确认访问路径是：

```text
http://服务器IP/admin
```

忘记后台密码：

```bash
cat /opt/amigo/server/.env
```

或直接修改：

```bash
nano /opt/amigo/server/.env
systemctl restart amigo
```

Hugo 构建失败：

```bash
cd /opt/amigo
hugo --minify
```

常见原因是文章 Front Matter 格式错误、短代码参数缺失或资源路径写错。

## 本地开发

后端：

```bash
npm --prefix server install
npm --prefix server run dev
```

后台：

```bash
npm --prefix admin install
npm --prefix admin run dev
```

Hugo：

```bash
hugo server -D
```

## 许可证

[MIT License](LICENSE)
