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

`data` 保存一份**只含单个人物**的 `ResumeVersionStore` JSON（该人物的草稿 + 他名下的全部快照），
`name` 存人物名，唯一键是 `(user_id, person_id)` —— **每个用户每个物一行**。

## 1b. 从「每用户一行」升级到「每人物一行」（已有数据必须执行）

如果你的表是按上面的旧结构建的（只有 `unique index (user_id)`，且没有 `person_id` 列），
请**整段一起执行**（必须同一事务，否则会出现「旧索引还在，第二个人物插不进去」或
「旧索引已删，仍开着旧页面的标签写入报错」）：

```sql
begin;
alter table public.resume_documents add column if not exists person_id text;
drop index if exists resume_documents_one_per_user;
create unique index if not exists resume_documents_one_per_person
  on public.resume_documents(user_id, person_id);
commit;
```

执行后**刷新页面**。旧结构遗留行（`person_id is null`）会在下次登录时被自动拆成人物行并删除；
拆分前不会动它，拆不动就保留原样并提示。`person_id` 保持可空，唯一性只在非空时生效。

如果没执行这段 SQL 就登录，应用会识别出表结构不对（错误码 `42703` / `23505` / `42P10`），
明确提示并在本地继续工作，而不会用旧结构写坏数据。


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
- 登录后先读取本地缓存，再按人物读取云端各行并合并：
  - 只存在于云端的人物 → 直接采用；
  - 只存在于本地的人物 → 推送到云端；
  - 两边都有且草稿内容相同 → 不写入；
  - 两边都有但草稿不同 → **以云端为准**，并把本地那份存为该人物名下的快照「云端覆盖前的本地副本」，
    本地独有的其他版本按 id 保留（版本并集）。
  - 合并是幂等的：重复登录不会不断产生新的冲突副本。
- 删除人物时会在本地记一条 tombstone，云端行确认删除后清除，避免另一台设备把它推回来。
- 编辑、保存版本、切换、重命名、删除和重置都会先保存本地，再串行同步**该人物**的切片到云端。
- 断网时可以继续编辑；恢复网络后会重新同步最新的本地数据。
- 同一人物在两台设备**同时在线**编辑时是后写覆盖（冲突只在登录合并时处理，运行期不做乐观并发）。


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
