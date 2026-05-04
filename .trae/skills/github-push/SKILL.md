---
name: "github-push"
description: "自动将代码推送到GitHub仓库。当用户输入'push到github'或'psuh到github'时触发，执行git add, commit和push操作。"
---

# GitHub推送技能

这个技能帮助用户自动将代码推送到GitHub仓库。当用户输入包含"push到github"或"psuh到github"（常见拼写错误）的指令时，该技能会自动触发。

## 功能

- 自动检测未提交的修改
- 执行git add添加所有修改
- 创建包含时间戳的提交信息
- 推送到远程GitHub仓库
- 提供推送状态反馈

## 使用场景

- 用户完成代码修改后想要快速推送到GitHub
- 用户输入"push到github"或类似指令时
- 需要自动化Git推送流程时

## 触发条件

当用户输入包含以下关键词的指令时自动触发：
- "push到github"
- "psuh到github"（常见拼写错误）
- "推送到github"
- "上传到github"

## 示例

用户输入："psuh到github"
技能会自动：
1. 检查Git状态
2. 添加所有修改文件
3. 创建提交信息
4. 推送到origin/master
5. 返回推送结果