# Amigo

朋友圈风格的个人动态站点，带 Hugo 前台、Vue 管理后台和 Node.js API 服务。

你可以把它当成一个轻量个人朋友圈：前台展示动态、图片、视频、音乐和长文章；后台负责发布内容、上传媒体、修改站点配置。

## 从零开始部署

准备一台干净的 Linux 服务器，SSH 登录进去后按系统执行下面命令。

Ubuntu / Debian：

```bash
apt update
apt install -y git
git clone https://github.com/Agff45/pyq.git amigo
cd amigo
bash deploy.sh
```

Rocky / AlmaLinux / CentOS Stream：

```bash
dnf install -y git || yum install -y git
git clone https://github.com/Agff45/pyq.git amigo
cd amigo
bash deploy.sh
```

如果当前不是 `root`，就在前面加 `sudo`：

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/Agff45/pyq.git amigo
cd amigo
bash deploy.sh
```

部署脚本会自动提权；如果系统提示输入密码，就输入 VPS 用户密码。

脚本跑完后会直接给出：

- 前台地址
- 后台地址
- 后台用户名
- 后台密码

默认地址：

```text
http://服务器IP/
http://服务器IP/admin
```

## 不想用 git 的下载方式

如果 VPS 没有 git，也可以下载压缩包：

```bash
curl -L https://github.com/Agff45/pyq/archive/refs/heads/master.tar.gz -o amigo.tar.gz
tar -xzf amigo.tar.gz
cd pyq-master
bash deploy.sh
```

如果提示 `curl` 不存在：

```bash
apt update && apt install -y curl
```

或者：

```bash
dnf install -y curl || yum install -y curl
```

## 已经有项目文件时部署

如果你已经把项目上传到了服务器，进入项目目录执行：

```bash
bash deploy.sh
```

第一次部署不需要手动安装 Node.js、Hugo、Nginx，也不需要手动配置 systemd。

## 部署前确认

服务器建议：

- Ubuntu 20.04+
- Debian 11+
- Rocky Linux 8+
- AlmaLinux 8+
- CentOS Stream 8+

必须满足：

- 服务器能访问公网
- 云服务器安全组放行 `80` 端口
- 当前用户能使用 `sudo`，或者直接使用 `root`

脚本会自动安装项目需要的系统包、Node.js 20、Hugo extended 和 Nginx。

## 带域名部署

先把域名解析到服务器 IP，然后执行：

```bash
DOMAIN=example.com bash deploy.sh
```

访问：

```text
http://example.com/
http://example.com/admin
```

脚本只配置 HTTP。需要 HTTPS 时，部署成功后再用 CDN 或 certbot 配证书。

## 自定义后台账号

```bash
ADMIN_USERNAME=myadmin ADMIN_PASSWORD='your-password' bash deploy.sh
```

不指定时：

- 用户名：`admin`
- 密码：脚本随机生成

密码会在部署结束时打印，也会写入：

```text
/opt/amigo/server/.env
```

## 自定义部署位置

一般不用改。确实需要时：

```bash
INSTALL_DIR=/srv/amigo PORT=4000 bash deploy.sh
```

说明：

- `INSTALL_DIR` 是项目安装目录，默认 `/opt/amigo`
- `PORT` 是 Node 服务端口，默认 `3000`
- Nginx 仍然监听 `80`，对外访问不需要带后端端口

## 部署脚本做了什么

`deploy.sh` 会自动完成：

1. 检测系统发行版。
2. 安装 `curl`、`rsync`、`openssl`、编译工具、Nginx 等依赖。
3. 安装或复用 Node.js 18+。
4. 安装或复用 Hugo extended 0.128+。
5. 复制项目到 `/opt/amigo`。
6. 生成 `server/.env`。
7. 安装 `server` 和 `admin` 依赖。
8. 构建 Vue 管理后台。
9. 构建 Hugo 静态站点。
10. 创建 `amigo` 系统用户。
11. 创建并启动 `amigo.service`。
12. 写入 Nginx 反向代理配置。
13. 如果系统启用了 `ufw` 或 `firewalld`，自动放行 HTTP。
14. 写入 `/var/lib/amigo/install.env`，用于卸载时清理。

## 重复部署

可以再次运行：

```bash
bash deploy.sh
```

重复部署会更新代码、重新构建并重启服务，但保留运行数据：

```text
/opt/amigo/content
/opt/amigo/static
/opt/amigo/server/.env
/opt/amigo/server/data
```

也就是文章、上传的媒体、后台密码和文章索引不会被覆盖。

## 一键卸载

部署成功后，执行：

```bash
bash /opt/amigo/uninstall.sh
```

卸载会删除：

- `/opt/amigo`
- `/var/lib/amigo`
- `amigo` systemd 服务
- `amigo` 系统用户
- Amigo 写入的 Nginx 配置
- Amigo 添加的防火墙 HTTP 规则

如果 Node.js、Hugo、Nginx 或基础依赖是脚本新安装的，卸载时也会清理。服务器原本就存在的运行时不会被删除。

## 部署后检查

查看服务状态：

```bash
systemctl status amigo
```

查看实时日志：

```bash
journalctl -u amigo -f
```

检查 Nginx：

```bash
nginx -t
systemctl status nginx
```

检查后端是否监听：

```bash
curl -I http://127.0.0.1:3000/admin
```

## 常用维护命令

重启：

```bash
systemctl restart amigo
```

重新构建 Hugo：

```bash
cd /opt/amigo
hugo --minify
systemctl restart amigo
```

查看后台账号配置：

```bash
cat /opt/amigo/server/.env
```

修改后台密码：

```bash
nano /opt/amigo/server/.env
systemctl restart amigo
```

## 后台能做什么

后台地址：

```text
http://服务器IP/admin
```

后台功能：

- 发布动态
- 保存草稿
- 编辑文章
- 删除文章
- 置顶文章
- 上传图片、视频、音乐、语音
- 插入视频、音乐、语音、实况照片短代码
- 修改站点标题、昵称、头像、简介、封面媒体等配置

## 目录说明

部署后：

```text
/opt/amigo
├── admin/dist        # 管理后台构建产物
├── content/posts     # 文章
├── public            # Hugo 构建产物
├── server/.env       # 后台账号、密码、端口、JWT 密钥
├── server/data       # 后台索引
├── static            # 图片、视频、音乐等资源
├── deploy.sh         # 部署脚本
└── uninstall.sh      # 卸载脚本
```

源码目录：

```text
admin/      # Vue 管理后台
assets/     # Hugo CSS/JS
content/    # 本地文章
layouts/    # Hugo 模板
server/     # Express API
static/     # 静态资源
```

## 内容格式

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

常用短代码：

```markdown
{{< music-card src="/music/song.mp3" cover="/images/cover.jpg" name="歌曲名" artist="艺术家" >}}

{{< video src="/videos/demo.mp4" poster="/images/poster.jpg" ratio="16/9" >}}

{{< voice src="/voice/audio.mp3" duration="12" >}}

{{< motion-photo image="/livephoto/photo.jpg" video="/livephoto/photo.mp4" ratio="3/4" >}}
```

## 排错

### 访问不到网站

先在服务器执行：

```bash
systemctl status amigo
nginx -t
systemctl status nginx
```

如果服务都正常，但外网访问不到，通常是云厂商安全组没放行 `80` 端口。

### 后台打不开

确认路径是：

```text
http://服务器IP/admin
```

如果你用域名部署：

```text
http://你的域名/admin
```

### 忘记后台密码

```bash
cat /opt/amigo/server/.env
```

或者改掉：

```bash
nano /opt/amigo/server/.env
systemctl restart amigo
```

### Hugo 构建失败

```bash
cd /opt/amigo
hugo --minify
```

常见原因：

- Front Matter YAML 格式错误
- 短代码参数缺失
- 图片或视频路径写错

### 部署脚本中途失败

先看失败位置。多数情况是网络无法访问 npm、GitHub、NodeSource 或系统软件源。

清理后重来：

```bash
bash /opt/amigo/uninstall.sh
bash deploy.sh
```

如果 `/opt/amigo/uninstall.sh` 不存在，说明还没部署成功，可以直接删除临时目录后重跑：

```bash
rm -rf /opt/amigo /var/lib/amigo
bash deploy.sh
```

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
