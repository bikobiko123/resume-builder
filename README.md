# 简历生成器 (Resume Builder)

一个基于 React + TypeScript 的简历生成工具，支持实时预览、Markdown 导入导出、PDF 导出等功能。

![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.0.5-646CFF?logo=vite)

## 功能特性

- **实时预览** - 左侧编辑，右侧实时预览 A4 尺寸简历
- **Markdown 支持** - 支持 Markdown 格式的导入和导出（含 YAML frontmatter）
- **PDF 导出** - 通过浏览器打印功能导出高质量 PDF
- **Word 导出** - 一键导出排版还原的 .docx 文件（A4 页面、章节分隔线、右对齐日期、项目符号、粗体内联语法）
- **版本管理** - 支持保存多个简历版本，自动保存到本地存储
- **照片上传** - 支持头像上传和裁剪
- **自适应布局** - 内容自动缩放适配 A4 纸张
- **响应式设计** - 支持桌面端和移动端浏览

## 支持的简历模块

- 个人信息（姓名、联系方式、地址、个人简介）
- 工作经历
- 教育背景
- 项目经历
- 技能（分类技能 + 语言能力）
- 证书
- 奖项/荣誉
- 社团/领导力经历
- 自定义模块

## 技术栈

- **框架**: React 19
- **语言**: TypeScript 5.7
- **构建工具**: Vite 6
- **测试**: Vitest
- **样式**: 原生 CSS（CSS Variables）
- **云端存储**: Supabase Auth + PostgreSQL JSONB（可选）

## 安装和运行

### 环境要求

- Node.js 18+
- npm 或 yarn

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/resume-builder.git
cd resume-builder

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

开发服务器默认运行在 http://localhost:5173/resume-builder/

### 构建生产版本

```bash
npm run build
```

构建输出将位于 `dist/` 目录。

### 运行测试

```bash
npm run test
```

## 使用指南

### 创建简历

1. 在左侧面板填写个人信息
2. 点击"添加章节"添加工作经历、教育背景等模块
3. 右侧面板实时预览 A4 效果
4. 点击"保存版本"保存当前进度

### 导入/导出

- **导出 Markdown** - 点击工具栏"导出 Markdown"按钮
- **导入 Markdown** - 点击"导入 Markdown"，选择包含 YAML frontmatter 的 .md 文件
- **导出 PDF** - 点击"导出 PDF"，使用浏览器打印功能保存为 PDF
- **导出 Word** - 点击"•••"菜单中的"导出 Word (.docx)"，下载可直接在 Word / WPS 中编辑的文档

### 版本管理

- 点击"版本管理"查看所有保存的版本
- 支持创建快照、重命名、删除和切换版本
- 最多保存 30 个历史版本

## 数据存储与云端同步

应用始终保留浏览器本地存储作为快速缓存和离线兜底：

- 存储键名: `resume_builder_versions_v1`
- 自动保存使用 300ms 防抖
- 未配置 Supabase 或未登录时，继续使用本地模式
- 配置 Supabase 并登录后，**每个物一份文档**（唯一键 `(user_id, person_id)`），
  `data` 存该人物的草稿与全部快照；云端按人物寻址，换设备不会互相覆盖
- 登录时按人物合并：云端赢，本地改动保留为该人物名下的快照「云端覆盖前的本地副本」
- 断网时仍可编辑，恢复网络后会自动同步

云端配置、**从旧结构升级的迁移 SQL**、认证 URL 和 GitHub Pages Secrets 说明见 [SUPABASE.md](./SUPABASE.md)。

## 数据隐私说明

- 云端数据通过 Supabase Auth 按用户隔离，数据库启用 Row Level Security
- 前端只使用 `VITE_SUPABASE_URL` 和 publishable/anon key，绝不使用 `service_role` key
- 本地与云端同一人物不一致时以云端为准，本地那份会保留为该人物名下的快照；删除人物会同步删除云端该行
- 清除浏览器数据不会删除已登录用户的云端简历，但未登录的本地数据仍建议定期用「导出 Markdown」备份

## 项目结构

```
├── src/
│   ├── components/      # React 组件
│   │   ├── Toolbar.tsx
│   │   ├── EditorPanel.tsx
│   │   ├── PreviewA4.tsx
│   │   └── ...
│   ├── lib/            # 工具函数
│   │   ├── storage.ts   # 本地存储管理
│   │   ├── pdf.ts       # PDF 导出
│   │   ├── word.ts      # Word (.docx) 导出
│   │   └── markdown.ts  # Markdown 处理
│   ├── types/          # TypeScript 类型定义
│   └── styles/         # CSS 样式
├── dist/               # 构建输出
└── package.json
```

## 在线预览

项目已部署到 GitHub Pages：
https://bikobiko123.github.io/resume-builder/

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 致谢

- 本项目简历模板设计灵感来自 [imprecv](https://github.com/jskherman/imprecv) - 一个优雅的 Typst 简历模板项目，感谢原作者的出色设计
- 感谢 React 和 Vite 团队提供的优秀工具
