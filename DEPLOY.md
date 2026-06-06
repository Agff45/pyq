# Amigo 一键部署文档

这份文档只服务一个目标：在一台干净的 Linux 服务器上，无脑部署 Amigo，并且能一键卸载干净。

部署脚本会自动完成这些事情：

- 安装系统依赖、Node.js 20、Hugo extended、Nginx。
- 复制项目到 `/opt/amigo`。
- 生成 `server/.env`，包含后台账号、密码和 JWT 密钥。
- 安装后端依赖，构建 Vue 管理后台，构建 Hugo 静态站点。
- 创建 `amigo` 系统用户。
- 创建并启动 `amigo` systemd 服务。
- 写入 Nginx 反向代理配置。
- 记录安装清单，供卸载脚本无残留清理。

## 支持系统

推荐使用全新的服务器：

- Ubuntu 20.04+
- Debian 11+
- Rocky Linux 8+
- AlmaLinux 8+
- CentOS Stream 8+

服务器需要能访问公网，因为脚本会下载系统包、Node.js 源、npm 包和 Hugo。

## 一键部署

把项目放到服务器任意目录后，进入项目目录执行：

```bash
bash deploy.sh
```

脚本结束后会输出：

- 站点地址
- 管理后台地址
- 后台用户名
- 后台密码
- 部署目录

默认访问地址：

```text
http://服务器IP/
http://服务器IP/admin
```

默认部署目录：

```text
/opt/amigo
```

## 带域名部署

如果域名已经解析到服务器，直接这样运行：

```bash
DOMAIN=example.com bash deploy.sh
```

部署完成后访问：

```text
http://example.com/
http://example.com/admin
```

脚本只配置 HTTP 80 端口，不自动申请 HTTPS 证书。需要 HTTPS 时，可以在部署成功后自行接入 CDN，或使用 certbot 给 Nginx 配置证书。

## 自定义后台账号密码

```bash
ADMIN_USERNAME=myadmin ADMIN_PASSWORD='my-strong-password' bash deploy.sh
```

如果不指定，脚本会自动生成：

- 用户名：`admin`
- 密码：随机 12 位十六进制字符串

密码也会写入：

```text
/opt/amigo/server/.env
```

## 自定义端口或部署目录

一般不需要改。确实要改时：

```bash
PORT=4000 INSTALL_DIR=/srv/amigo bash deploy.sh
```

Nginx 仍然监听 80 端口，对外访问不需要带端口。

## 重复执行部署脚本

可以重复执行：

```bash
bash deploy.sh
```

重复部署会覆盖程序代码并重启服务，但会保留这些运行数据：

- `/opt/amigo/content`
- `/opt/amigo/static`
- `/opt/amigo/server/.env`
- `/opt/amigo/server/data`

也就是说，后台上传的媒体、文章、账号密码不会被更新部署覆盖。

## 一键卸载

部署成功后，卸载脚本会在部署目录中。执行：

```bash
bash /opt/amigo/uninstall.sh
```

卸载会删除：

- `amigo` systemd 服务
- `amigo` 系统用户
- `/opt/amigo` 部署目录
- `/var/lib/amigo` 安装清单
- Amigo 的 Nginx 配置
- 脚本为 Amigo 添加的防火墙 80 端口规则
- 脚本为 Amigo 新安装的 Hugo、Node.js、Nginx 和基础依赖

卸载不会删除服务器原本就存在的 Node.js、Hugo、Nginx 或系统依赖。脚本通过 `/var/lib/amigo/install.env` 判断哪些东西是部署时新装的。

如果安装清单丢失，卸载脚本会按默认路径清理 Amigo 服务、用户、Nginx 配置和 `/opt/amigo`，但不会尝试卸载系统运行时。

## 常用运维命令

查看服务状态：

```bash
systemctl status amigo
```

查看实时日志：

```bash
journalctl -u amigo -f
```

重启服务：

```bash
systemctl restart amigo
```

重新构建站点：

```bash
cd /opt/amigo
hugo --minify
systemctl restart amigo
```

查看后台配置：

```bash
cat /opt/amigo/server/.env
```

## 目录说明

```text
/opt/amigo
├── admin/dist              # Vue 管理后台构建产物
├── content/posts           # Hugo 文章
├── public                  # Hugo 静态站点构建产物
├── server/.env             # 后台账号、密码、端口、JWT 密钥
├── server/data             # 后台文章索引
├── static                  # 图片、视频、音乐等静态资源
├── deploy.sh               # 部署脚本副本
└── uninstall.sh            # 卸载脚本副本
```

## 故障排查

### 访问不到站点

先看服务是否启动：

```bash
systemctl status amigo
```

再看 Nginx 是否正常：

```bash
nginx -t
systemctl status nginx
```

云服务器还需要在云厂商安全组里放行 80 端口。脚本只能处理系统内的 `ufw` 或 `firewalld`，不能替你改云平台安全组。

### 后台打不开

确认访问路径是：

```text
http://服务器IP/admin
```

如果部署时指定了域名，则访问：

```text
http://你的域名/admin
```

### 忘记后台密码

查看配置文件：

```bash
cat /opt/amigo/server/.env
```

或直接改密码：

```bash
nano /opt/amigo/server/.env
systemctl restart amigo
```

### Hugo 构建失败

手动看错误：

```bash
cd /opt/amigo
hugo --minify
```

常见原因是文章 Front Matter 格式错误、短代码参数缺失、图片路径写错。

## 脚本行为边界

部署脚本会接管：

- `/opt/amigo`
- `/var/lib/amigo`
- `/etc/systemd/system/amigo.service`
- `/etc/nginx/conf.d/amigo.conf`
- `/etc/nginx/sites-available/amigo`
- `/etc/nginx/sites-enabled/amigo`
- `amigo` 系统用户

卸载脚本会清理上述资源。除此之外，它只清理部署时明确记录为“由 Amigo 新安装”的系统组件。
