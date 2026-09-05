# Supabase 云端存储配置

简历生成器默认继续使用 `localStorage`，配置 Supabase 后，登录用户可以在不同浏览器和设备间同步简历。

## 1. 创建数据表

在 Supabase 项目的 SQL Editor 中执行：

```sql
create table public.resume_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '我的简历',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index resume_documents_one_per_user
on public.resume_documents(user_id);

alter table public.resume_documents enable row level security;

create policy "Users can read their own resumes"
on public.resume_documents
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own resumes"
on public.resume_documents
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own resumes"
on public.resume_documents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own resumes"
on public.resume_documents
for delete
to authenticated
using (auth.uid() = user_id);
```

`data` 直接保存现有的 `ResumeVersionStoreV1` JSON，版本管理仍由 `versions` 数组负责。当前每个用户只有一份文档。

## 2. 配置本地环境

复制 `.env.example` 为 `.env.local`，填入 Supabase 控制台中的 Project URL 和 publishable/anon key：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的_publishable_或_anon_key
```

`.env`、`.env.local` 和 `.env.*.local` 已被 `.gitignore` 忽略。不要使用或提交 `service_role` key。

如果环境变量缺失，应用会显示“本地模式”，所有原有编辑、版本管理、Markdown/PDF 导出功能仍可用。

## 3. 认证与同步行为

- 使用 Supabase Email + Password 注册、登录和登出。
- 未登录时仅使用 `localStorage`。
- 登录后先读取本地缓存，再读取云端；云端存在数据时以云端为准。
- 首次登录且云端没有数据时，会自动上传本地版本，并在上传前生成 `resume_builder_migration_backup_<timestamp>` 本地备份。
- 本地和云端数据都存在且不一致时，界面会提示当前使用云端版本，本地版本仍保留在浏览器中。
- 编辑、保存版本、切换、重命名、删除和重置都会先保存本地，再串行同步完整 JSON 到云端。
- 断网时可以继续编辑；恢复网络后会重新同步最新的本地数据。

## 4. Supabase Auth URL 配置

在 **Authentication → URL Configuration** 中加入：

```text
https://bikobiko123.github.io/resume-builder/
http://localhost:5173/resume-builder/
```

如果项目启用了邮箱确认，还需要按 Supabase 控制台提示配置邮件模板和 Site URL。

## 5. GitHub Pages Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vite 变量在构建时注入，因此 workflow 的 Build 步骤必须显式传入：

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```
