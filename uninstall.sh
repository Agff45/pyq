#!/usr/bin/env bash
set -Eeuo pipefail

# Amigo zero-touch uninstaller. Removes files and services created by deploy.sh.

MANIFEST="${MANIFEST:-/var/lib/amigo/install.env}"
SERVICE_NAME="amigo"
APP_USER="amigo"
INSTALL_DIR="/opt/amigo"
PKG_FAMILY=""
NODE_INSTALLED_BY_AMIGO=0
HUGO_INSTALLED_BY_AMIGO=0
NGINX_INSTALLED_BY_AMIGO=0
DEFAULT_SITE_DISABLED_BY_AMIGO=0
UFW_HTTP_ADDED_BY_AMIGO=0
FIREWALLD_HTTP_ADDED_BY_AMIGO=0
BASE_PACKAGES_ADDED=""
NGINX_CONF_D="/etc/nginx/conf.d/amigo.conf"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available/amigo"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/amigo"
SYSTEMD_SERVICE="/etc/systemd/system/amigo.service"

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
    exec sudo env MANIFEST="$MANIFEST" bash "$0" "$@"
  fi
  err "请使用 root 运行，或先安装 sudo。"
  exit 1
}

load_manifest() {
  if [ -f "$MANIFEST" ]; then
    # shellcheck disable=SC1090
    . "$MANIFEST"
  else
    warn "未找到安装清单 $MANIFEST，将按默认路径清理。"
  fi
}

stop_service() {
  step "停止并移除 systemd 服务"
  if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
    systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
  fi
  rm -f "$SYSTEMD_SERVICE" "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl reset-failed "$SERVICE_NAME" >/dev/null 2>&1 || true
}

remove_nginx_config() {
  step "移除 Nginx 配置"
  rm -f "$NGINX_CONF_D" "$NGINX_SITES_AVAILABLE" "$NGINX_SITES_ENABLED"
  if [ "${DEFAULT_SITE_DISABLED_BY_AMIGO:-0}" = "1" ] && [ -f /etc/nginx/sites-available/default ] && [ -d /etc/nginx/sites-enabled ]; then
    ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  fi
  if command -v nginx >/dev/null 2>&1; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx >/dev/null 2>&1 || true
    else
      warn "Nginx 当前配置测试未通过，已删除 Amigo 配置但未 reload。"
    fi
  fi
}

remove_install_dir() {
  step "删除部署目录和安装清单"
  if [ -n "$INSTALL_DIR" ] && [ "$INSTALL_DIR" != "/" ] && [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
  fi
  rm -rf "$(dirname "$MANIFEST")"
}

remove_firewall_rules() {
  step "恢复脚本添加的防火墙规则"
  if [ "${UFW_HTTP_ADDED_BY_AMIGO:-0}" = "1" ] && command -v ufw >/dev/null 2>&1; then
    ufw delete allow 80/tcp >/dev/null 2>&1 || true
  fi
  if [ "${FIREWALLD_HTTP_ADDED_BY_AMIGO:-0}" = "1" ] && command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --remove-service=http >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

remove_user() {
  step "删除系统用户"
  if id "$APP_USER" >/dev/null 2>&1; then
    userdel "$APP_USER" >/dev/null 2>&1 || true
  fi
}

remove_hugo_if_owned() {
  if [ "${HUGO_INSTALLED_BY_AMIGO:-0}" != "1" ]; then
    return
  fi
  step "卸载脚本安装的 Hugo"
  rm -f /usr/local/bin/hugo
}

remove_node_if_owned() {
  if [ "${NODE_INSTALLED_BY_AMIGO:-0}" != "1" ]; then
    return
  fi
  step "卸载脚本安装的 Node.js"
  if [ "$PKG_FAMILY" = "debian" ]; then
    apt-get purge -y nodejs >/dev/null 2>&1 || true
    apt-get autoremove -y >/dev/null 2>&1 || true
    rm -f /etc/apt/sources.list.d/nodesource.list
    rm -f /etc/apt/keyrings/nodesource.gpg /usr/share/keyrings/nodesource.gpg
  elif [ "$PKG_FAMILY" = "rhel" ]; then
    if command -v dnf >/dev/null 2>&1; then
      dnf remove -y nodejs >/dev/null 2>&1 || true
    else
      yum remove -y nodejs >/dev/null 2>&1 || true
    fi
    rm -f /etc/yum.repos.d/nodesource*.repo
  fi
}

remove_nginx_if_owned() {
  if [ "${NGINX_INSTALLED_BY_AMIGO:-0}" != "1" ]; then
    return
  fi
  step "卸载脚本安装的 Nginx"
  systemctl disable --now nginx >/dev/null 2>&1 || true
  if [ "$PKG_FAMILY" = "debian" ]; then
    apt-get purge -y nginx nginx-common >/dev/null 2>&1 || true
    apt-get autoremove -y >/dev/null 2>&1 || true
    rm -rf /etc/nginx
  elif [ "$PKG_FAMILY" = "rhel" ]; then
    if command -v dnf >/dev/null 2>&1; then
      dnf remove -y nginx >/dev/null 2>&1 || true
    else
      yum remove -y nginx >/dev/null 2>&1 || true
    fi
    rm -rf /etc/nginx
  fi
}

remove_base_packages_if_owned() {
  if [ -z "${BASE_PACKAGES_ADDED:-}" ]; then
    return
  fi
  step "卸载脚本新增的基础依赖"
  if [ "$PKG_FAMILY" = "debian" ]; then
    apt-get purge -y $BASE_PACKAGES_ADDED >/dev/null 2>&1 || true
    apt-get autoremove -y >/dev/null 2>&1 || true
  elif [ "$PKG_FAMILY" = "rhel" ]; then
    if command -v dnf >/dev/null 2>&1; then
      dnf remove -y $BASE_PACKAGES_ADDED >/dev/null 2>&1 || true
    else
      yum remove -y $BASE_PACKAGES_ADDED >/dev/null 2>&1 || true
    fi
  fi
}

main() {
  run_as_root "$@"
  load_manifest
  stop_service
  remove_nginx_config
  remove_firewall_rules
  remove_install_dir
  remove_user
  remove_hugo_if_owned
  remove_node_if_owned
  remove_nginx_if_owned
  remove_base_packages_if_owned
  log "Amigo 已卸载完成。"
}

main "$@"
