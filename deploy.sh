#!/usr/bin/env bash
set -e

# =============================================================================
# Amigo 一键部署脚本
# 适用: Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / Rocky Linux
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
ADMIN_DIR="$PROJECT_DIR/admin"

log()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "\n${CYAN}========================================${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}========================================${NC}"; }

# =============================================================================
# 1. 检测系统环境
# =============================================================================
step "1/7  检测系统环境"

OS="$(uname -s)"
if [ "$OS" != "Linux" ]; then
    err "此脚本仅支持 Linux 系统"
    exit 1
fi

NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    err "需要 Node.js >= 18，当前: $(node -v 2>/dev/null || echo '未安装')"
    echo ""
    echo "  请先安装 Node.js 20 LTS:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    echo ""
    echo "  或者使用 nvm:"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "    nvm install 20"
    exit 1
fi
log "Node.js $(node -v) ✓"
log "npm $(npm -v) ✓"

if command -v hugo &>/dev/null; then
    log "Hugo $(hugo version | grep -oP 'v\K[0-9.]+') ✓"
    HUGO_AVAILABLE=true
else
    warn "Hugo 未安装（如只需管理后台可忽略）"
    HUGO_AVAILABLE=false
fi

# =============================================================================
# 2. 生成 .env
# =============================================================================
step "2/7  生成环境配置"

ENV_FILE="$SERVER_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 6 2>/dev/null || head -c 6 /dev/urandom | xxd -p)}"

    cat > "$ENV_FILE" << EOF
JWT_SECRET=${JWT_SECRET}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
PORT=${PORT:-3000}
EOF
    log ".env 已生成"
    echo ""
    echo -e "  ${YELLOW}══════════════════════════════════════════${NC}"
    echo -e "  ${YELLOW}  管理员账号密码（请妥善保管）${NC}"
    echo -e "  ${YELLOW}══════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}用户名:${NC} ${ADMIN_USERNAME}"
    echo -e "  ${GREEN}密  码:${NC} ${ADMIN_PASSWORD}"
    echo -e "  ${YELLOW}══════════════════════════════════════════${NC}"
    echo ""
else
    log ".env 已存在，跳过"
    source "$ENV_FILE" 2>/dev/null || true
fi

# =============================================================================
# 3. 安装后端依赖
# =============================================================================
step "3/7  安装后端依赖"

cd "$SERVER_DIR"
if [ -d "node_modules" ]; then
    log "后端依赖已安装，执行更新..."
fi
npm install --production --prefer-offline
log "后端依赖安装完成 ✓"

# =============================================================================
# 4. 安装并构建管理后台
# =============================================================================
step "4/7  构建管理后台"

cd "$ADMIN_DIR"
if [ -d "node_modules" ]; then
    log "前端依赖已安装，执行更新..."
fi
npm install --prefer-offline
npx vite build
log "管理后台构建完成 ✓"

# =============================================================================
# 5. 构建 Hugo 静态站点
# =============================================================================
step "5/7  构建 Hugo 静态站点"

cd "$PROJECT_DIR"
if [ "$HUGO_AVAILABLE" = true ]; then
    if hugo --minify 2>/dev/null; then
        log "Hugo 站点构建完成 ✓"
    else
        warn "Hugo 构建失败，如无内容可忽略"
    fi
else
    log "跳过 Hugo 构建（未安装 Hugo）"
    log "安装 Hugo: snap install hugo  或  apt install hugo"
fi

# =============================================================================
# 6. 配置 PM2 进程管理
# =============================================================================
step "6/7  配置 PM2"

PM2_ECOSYSTEM="$PROJECT_DIR/ecosystem.config.cjs"

cat > "$PM2_ECOSYSTEM" << 'PM2EOF'
module.exports = {
  apps: [{
    name: 'amigo',
    script: 'server/src/app.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_memory_restart: '300M',
    autorestart: true,
    watch: false,
  }]
};
PM2EOF

mkdir -p "$PROJECT_DIR/logs"

if command -v pm2 &>/dev/null; then
    pm2 delete amigo 2>/dev/null || true
    pm2 start "$PM2_ECOSYSTEM"
    pm2 save
    log "PM2 已启动 amigo 服务 ✓"

    if ! pm2 startup systemd 2>/dev/null | grep -q 'already'; then
        echo ""
        warn "运行以下命令以启用开机自启:"
        pm2 startup 2>&1 | tail -1
    fi
else
    warn "PM2 未安装，使用 nohup 启动"
    nohup node "$SERVER_DIR/src/app.js" > "$PROJECT_DIR/logs/app.log" 2>&1 &
    echo $! > "$PROJECT_DIR/logs/app.pid"
    log "服务已后台启动 (PID: $(cat $PROJECT_DIR/logs/app.pid))"

    echo ""
    echo -e "  ${YELLOW}建议安装 PM2 以获得更好的进程管理:${NC}"
    echo "    npm install -g pm2"
    echo "    pm2 start ecosystem.config.cjs"
    echo "    pm2 save && pm2 startup"
fi

# =============================================================================
# 7. 输出访问信息
# =============================================================================
step "7/7  部署完成"

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "你的服务器IP")
PORT="${PORT:-3000}"

echo ""
echo -e "  ${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}║         Amigo 部署成功！                  ║${NC}"
echo -e "  ${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "  ${GREEN}║${NC}  管理后台: ${CYAN}http://${IP}:${PORT}/admin${NC}"
echo -e "  ${GREEN}║${NC}  Hugo站点: ${CYAN}http://${IP}:${PORT}${NC}"
echo -e "  ${GREEN}║${NC}  API 接口: ${CYAN}http://${IP}:${PORT}/api${NC}"
echo -e "  ${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "  ${GREEN}║${NC}  管理员:  ${ADMIN_USERNAME:-admin}"
echo -e "  ${GREEN}║${NC}  密码:    ${ADMIN_PASSWORD:-见 server/.env}"
echo -e "  ${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

if ! command -v pm2 &>/dev/null; then
    log "停止服务: kill \$(cat $PROJECT_DIR/logs/app.pid)"
fi
log "查看日志: tail -f $PROJECT_DIR/logs/out.log"
log "重启服务: pm2 restart amigo"
echo ""
log "脚本完毕。祝使用愉快！🎉"
