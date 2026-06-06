#!/usr/bin/env bash
set -Eeuo pipefail

# Amigo zero-touch installer.
# Supported: Debian/Ubuntu, RHEL/CentOS/Rocky/Alma.

APP_NAME="amigo"
SERVICE_NAME="amigo"
APP_USER="amigo"
INSTALL_DIR="${INSTALL_DIR:-/opt/amigo}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-_}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
FORCE="${FORCE:-0}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="/var/lib/amigo/install.env"
NODE_INSTALLED_BY_AMIGO=0
HUGO_INSTALLED_BY_AMIGO=0
HUGO_VERSION_REQUIRED="0.162.1"
NGINX_INSTALLED_BY_AMIGO=0
DEFAULT_SITE_DISABLED_BY_AMIGO=0
UFW_HTTP_ADDED_BY_AMIGO=0
FIREWALLD_HTTP_ADDED_BY_AMIGO=0
BASE_PACKAGES_ADDED=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step() { echo -e "\n${CYAN}==>${NC} $*"; }

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    exec sudo env \
      INSTALL_DIR="$INSTALL_DIR" \
      PORT="$PORT" \
      DOMAIN="$DOMAIN" \
      ADMIN_USERNAME="$ADMIN_USERNAME" \
      ADMIN_PASSWORD="$ADMIN_PASSWORD" \
      JWT_SECRET="$JWT_SECRET" \
      FORCE="$FORCE" \
      bash "$0" "$@"
  fi
  err "请使用 root 运行，或先安装 sudo。"
  exit 1
}

detect_os() {
  if [ ! -r /etc/os-release ]; then
    err "无法识别 Linux 发行版。"
    exit 1
  fi
  . /etc/os-release
  OS_ID="${ID:-}"
  OS_LIKE="${ID_LIKE:-}"
  if [[ "$OS_ID $OS_LIKE" == *debian* ]] || [[ "$OS_ID $OS_LIKE" == *ubuntu* ]]; then
    PKG_FAMILY="debian"
  elif [[ "$OS_ID $OS_LIKE" == *rhel* ]] || [[ "$OS_ID $OS_LIKE" == *fedora* ]] || [[ "$OS_ID $OS_LIKE" == *centos* ]]; then
    PKG_FAMILY="rhel"
  else
    err "暂不支持当前系统: ${PRETTY_NAME:-unknown}"
    exit 1
  fi
}

package_installed() {
  local pkg="$1"
  if [ "$PKG_FAMILY" = "debian" ]; then
    dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"
  else
    rpm -q "$pkg" >/dev/null 2>&1
  fi
}

install_packages() {
  step "安装系统依赖"
  local base_packages nginx_package
  if ! command -v nginx >/dev/null 2>&1; then
    NGINX_INSTALLED_BY_AMIGO=1
  fi
  if [ "$PKG_FAMILY" = "debian" ]; then
    base_packages="curl ca-certificates gnupg tar xz-utils rsync build-essential openssl"
    nginx_package="nginx"
    for pkg in $base_packages; do
      if ! package_installed "$pkg"; then
        BASE_PACKAGES_ADDED="${BASE_PACKAGES_ADDED}${BASE_PACKAGES_ADDED:+ }${pkg}"
      fi
    done
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y $base_packages "$nginx_package"
  else
    base_packages="curl ca-certificates gnupg tar xz rsync gcc gcc-c++ make openssl"
    nginx_package="nginx"
    for pkg in $base_packages; do
      if ! package_installed "$pkg"; then
        BASE_PACKAGES_ADDED="${BASE_PACKAGES_ADDED}${BASE_PACKAGES_ADDED:+ }${pkg}"
      fi
    done
    if command -v dnf >/dev/null 2>&1; then
      dnf install -y $base_packages "$nginx_package"
    else
      yum install -y $base_packages "$nginx_package"
    fi
  fi
}

install_node() {
  step "检查 Node.js"
  local major=""
  if command -v node >/dev/null 2>&1; then
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  fi
  if [ -n "$major" ] && [ "$major" -ge 18 ]; then
    log "Node.js $(node -v) 已满足要求。"
    return
  fi

  log "安装 Node.js 20 LTS。"
  NODE_INSTALLED_BY_AMIGO=1
  if [ "$PKG_FAMILY" = "debian" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    if command -v dnf >/dev/null 2>&1; then
      dnf install -y nodejs
    else
      yum install -y nodejs
    fi
  fi
}

hugo_ok() {
  command -v hugo >/dev/null 2>&1 || return 1
  local current oldest
  current="$(hugo version | sed -n 's/.*v\([0-9][0-9.]*\).*/\1/p' | head -n1)"
  [ -n "$current" ] || return 1
  oldest="$(printf '%s\n%s\n' "$HUGO_VERSION_REQUIRED" "$current" | sort -V | head -n1)"
  [ "$oldest" = "$HUGO_VERSION_REQUIRED" ]
}

install_hugo() {
  step "检查 Hugo"
  if hugo_ok; then
    log "$(hugo version) 已满足要求。"
    return
  fi

  local version="$HUGO_VERSION_REQUIRED"
  HUGO_INSTALLED_BY_AMIGO=1
  local arch
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) err "Hugo 自动安装暂不支持架构: $(uname -m)"; exit 1 ;;
  esac
  local url="https://github.com/gohugoio/hugo/releases/download/v${version}/hugo_extended_${version}_linux-${arch}.tar.gz"
  local tmp
  tmp="$(mktemp -d)"
  curl -fL "$url" -o "$tmp/hugo.tar.gz"
  tar -xzf "$tmp/hugo.tar.gz" -C "$tmp"
  install -m 0755 "$tmp/hugo" /usr/local/bin/hugo
  rm -rf "$tmp"
  log "$(hugo version) 安装完成。"
}

random_hex() {
  openssl rand -hex "$1"
}

quote_env() {
  local value="$1"
  if [[ "$value" =~ ^[A-Za-z0-9_./:@+-]+$ ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$value" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>process.stdout.write(JSON.stringify(s)))"
  fi
}

prepare_install_dir() {
  step "准备部署目录"
  local seed_content=0
  local seed_static=0
  if [ ! -d "$INSTALL_DIR/content" ]; then
    seed_content=1
  fi
  if [ ! -d "$INSTALL_DIR/static" ]; then
    seed_static=1
  fi

  if [ -e "$INSTALL_DIR" ] && [ "$FORCE" != "1" ]; then
    warn "$INSTALL_DIR 已存在。将复用该目录并覆盖代码文件，保留 content/static/server/.env。"
  fi

  mkdir -p "$INSTALL_DIR"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='server/node_modules' \
    --exclude='admin/node_modules' \
    --exclude='server/.env' \
    --exclude='server/data' \
    --exclude='content' \
    --exclude='static' \
    --exclude='public' \
    --exclude='admin/dist' \
    "$SOURCE_DIR/" "$INSTALL_DIR/"

  mkdir -p "$INSTALL_DIR/content/posts" "$INSTALL_DIR/server/data" "$INSTALL_DIR/logs"
  if [ "$seed_content" = "1" ] && [ -d "$SOURCE_DIR/content" ]; then
    rsync -a "$SOURCE_DIR/content/" "$INSTALL_DIR/content/"
  fi
  if [ "$seed_static" = "1" ] && [ -d "$SOURCE_DIR/static" ]; then
    rsync -a "$SOURCE_DIR/static/" "$INSTALL_DIR/static/"
  fi
}

write_env() {
  step "生成服务配置"
  local env_file="$INSTALL_DIR/server/.env"
  if [ -f "$env_file" ]; then
    log "$env_file 已存在，保留原配置。"
    return
  fi

  if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD="$(random_hex 6)"
  fi
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(random_hex 32)"
  fi

  cat > "$env_file" << EOF
JWT_SECRET=$(quote_env "$JWT_SECRET")
ADMIN_USERNAME=$(quote_env "$ADMIN_USERNAME")
ADMIN_PASSWORD=$(quote_env "$ADMIN_PASSWORD")
PORT=$PORT
EOF
  chmod 0640 "$env_file"
}

install_app_dependencies() {
  step "安装项目依赖并构建"
  npm --prefix "$INSTALL_DIR/server" ci --omit=dev
  npm --prefix "$INSTALL_DIR/admin" ci
  npm --prefix "$INSTALL_DIR/admin" run build
  (cd "$INSTALL_DIR" && hugo --minify)
}

write_systemd_service() {
  step "配置 systemd 服务"
  local nologin="/usr/sbin/nologin"
  if [ ! -x "$nologin" ]; then
    nologin="/sbin/nologin"
  fi
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home "$INSTALL_DIR" --shell "$nologin" "$APP_USER"
  fi

  chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"

  cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Amigo Blog Service
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/env node $INSTALL_DIR/server/src/app.js
Restart=always
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
}

write_nginx() {
  step "配置 Nginx 反向代理"
  local conf_path
  if [ -d /etc/nginx/sites-available ]; then
    conf_path="/etc/nginx/sites-available/amigo"
  else
    conf_path="/etc/nginx/conf.d/amigo.conf"
  fi

  cat > "$conf_path" << EOF
server {
    listen 80;
    server_name $DOMAIN;
    charset utf-8;
    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
EOF

  if [ -d /etc/nginx/sites-enabled ]; then
    if [ -e /etc/nginx/sites-enabled/default ]; then
      rm -f /etc/nginx/sites-enabled/default
      DEFAULT_SITE_DISABLED_BY_AMIGO=1
    fi
    ln -sfn "$conf_path" /etc/nginx/sites-enabled/amigo
  fi

  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    if ! ufw status | grep -Eq '(^|[[:space:]])80/tcp[[:space:]]+ALLOW|(^|[[:space:]])Nginx HTTP[[:space:]]+ALLOW'; then
      ufw allow 80/tcp >/dev/null || true
      UFW_HTTP_ADDED_BY_AMIGO=1
    fi
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    if ! firewall-cmd --permanent --query-service=http >/dev/null 2>&1; then
      firewall-cmd --permanent --add-service=http >/dev/null || true
      firewall-cmd --reload >/dev/null || true
      FIREWALLD_HTTP_ADDED_BY_AMIGO=1
    fi
  fi
}

write_manifest() {
  mkdir -p "$(dirname "$MANIFEST")"
  cat > "$MANIFEST" << EOF
APP_NAME=$APP_NAME
SERVICE_NAME=$SERVICE_NAME
APP_USER=$APP_USER
INSTALL_DIR=$INSTALL_DIR
PORT=$PORT
DOMAIN=$DOMAIN
PKG_FAMILY=$PKG_FAMILY
NODE_INSTALLED_BY_AMIGO=$NODE_INSTALLED_BY_AMIGO
HUGO_INSTALLED_BY_AMIGO=$HUGO_INSTALLED_BY_AMIGO
NGINX_INSTALLED_BY_AMIGO=$NGINX_INSTALLED_BY_AMIGO
DEFAULT_SITE_DISABLED_BY_AMIGO=$DEFAULT_SITE_DISABLED_BY_AMIGO
UFW_HTTP_ADDED_BY_AMIGO=$UFW_HTTP_ADDED_BY_AMIGO
FIREWALLD_HTTP_ADDED_BY_AMIGO=$FIREWALLD_HTTP_ADDED_BY_AMIGO
BASE_PACKAGES_ADDED='$BASE_PACKAGES_ADDED'
NGINX_CONF_D=/etc/nginx/conf.d/amigo.conf
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available/amigo
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled/amigo
SYSTEMD_SERVICE=/etc/systemd/system/${SERVICE_NAME}.service
EOF
}

print_result() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "$ip" ] || ip="服务器IP"
  local site_host="$ip"
  if [ "$DOMAIN" != "_" ]; then
    site_host="$DOMAIN"
  fi

  echo
  echo -e "${GREEN}Amigo 部署完成。${NC}"
  echo -e "站点地址:   ${CYAN}http://${site_host}/${NC}"
  echo -e "管理后台:   ${CYAN}http://${site_host}/admin${NC}"
  echo -e "服务端口:   ${CYAN}${PORT}${NC}"
  echo -e "部署目录:   ${CYAN}${INSTALL_DIR}${NC}"
  echo -e "登录用户:   ${CYAN}${ADMIN_USERNAME}${NC}"
  if [ -n "$ADMIN_PASSWORD" ]; then
    echo -e "登录密码:   ${CYAN}${ADMIN_PASSWORD}${NC}"
  else
    echo -e "登录密码:   ${CYAN}见 $INSTALL_DIR/server/.env${NC}"
  fi
  echo
  echo "常用命令:"
  echo "  systemctl status amigo"
  echo "  journalctl -u amigo -f"
  echo "  bash $INSTALL_DIR/uninstall.sh"
}

main() {
  run_as_root "$@"
  detect_os
  install_packages
  install_node
  install_hugo
  prepare_install_dir
  write_env
  install_app_dependencies
  write_systemd_service
  write_nginx
  write_manifest
  print_result
}

main "$@"
