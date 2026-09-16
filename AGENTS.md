# 简历接口（给 agent 用）

这个仓库有一个网页版简历编辑器，以及一层直接操作简历文档的命令行接口。
网页版给人用，`resume` 给 agent 用：读写同一份 JSON，共用同一套排版。

```bash
./bin/resume --help          # 全部命令
npm run resume -- --help     # 等价写法
```

依赖已经装好；命令用 `tsx` 直接跑 TypeScript，改完即可用，没有构建步骤。
`measure` 需要一个真实浏览器（本机已装 Chrome）。

---

## 先记住三件事

1. **`resume.json` 是唯一事实源。** 它就是网页版里那个人物的 `ResumeState`
   （`personal` + `sections` + `photo` + `fontSizePt` + `fontFamily` + `headerAlignment` + 一堆 `show*` 开关）。
   Markdown 是给人看的**有损视图**，不要拿它当源，也不要整篇重写 JSON。
2. **寻址用 JSON Pointer，数组段既接受索引也接受 `id`。** 用 id 的话，插入、删除、
   重排之后地址依然有效——这是做小步编辑而不是重写全文的前提。
3. **排版是硬约束，不是事后检查。** 内容改完要 `measure`，它会告诉你是不是还装得下
   一页、被缩到了多少。不 measure 就调文案，等于盲改。

---

## 常用流程

```bash
# 1. 读出规范文档（含 id）
./bin/resume get --in cv.json --out work.json

# 2. 要么用 patch 改 JSON（推荐，精确且可重复）
cat > edits.json <<'EOF'
[
  { "op": "replace",
    "path": "/sections/sec-工作经历/workEntries/work-acme/positions/pos-产品经理/highlights/0",
    "value": "负责核心链路重构，月活 **+28%**" },
  { "op": "add",
    "path": "/sections/sec-工作经历/workEntries/work-acme/positions/pos-产品经理/highlights/-",
    "value": "搭起 A/B 实验流程，需求验证周期从两周压到三天" }
]
EOF
./bin/resume patch --in cv.json --patch edits.json

# 3. 要么把 JSON 导成 Markdown 改文案，再合回去
./bin/resume md --in cv.json --out cv.md
# ...编辑 cv.md...
./bin/resume import --in cv.md --into cv.json

# 4. 检查内容问题
./bin/resume validate --in cv.json

# 5. 检查排版
./bin/resume measure --in cv.json

# 6. 出稿
./bin/resume render --in cv.json --format docx --out cv.docx
./bin/resume render --in cv.json --format pdf  --out cv.pdf
```

命令的读写约定：读类命令默认从 stdin 读（`cat cv.json | ./bin/resume get`），
写类命令（`ids` / `patch` / `import`）**默认原地写回 `--in` 指定的文件**，
用 `--out` 换路径，用 `--dry-run` 只打印不写。

退出码：`0` 成功，`1` 操作失败（patch 失败、校验有 error、找不到浏览器），
`2` 用法错误。stdout 只放请求的文档或一个 JSON 信封（`{"ok":false,"error":{...}}`），
stderr 放给人看的诊断和提示。

---

## 命令

| 命令 | 作用 |
| --- | --- |
| `get` | 输出规范化后的简历 JSON（补齐 id、补齐缺省字段） |
| `md` | 输出 Markdown 编辑视图 |
| `validate` | 字段缺失、占位空串、读不懂的日期、开关空转、寻址问题 |
| `measure` | 在真实浏览器里测量 A4 排版：页数、缩放、各章节占用 |
| `ids` | 补全缺失的 id 并写回；`--rewrite` 从内容重写全部 id |
| `patch` | JSON Patch 局部改（推荐） |
| `import` | 把改过的 Markdown 合回 JSON（只合并章节） |
| `render` | 导出渲染产物（`--format docx` 或 `--format pdf`） |

### 寻址

路径是 JSON Pointer（RFC 6901）。数组的一段若是纯数字，按索引；否则按该元素的
`id` 匹配。

```text
/sections/0                                            第 0 个章节（含隐藏章节的编号）
/sections/sec-工作经历                                 按章节 id
/sections/0/workEntries/work-acme/positions/pos-产品经理   按条目 id
/sections/0/educationEntries/0/highlights/1            按索引——字符串数组没有 id
/sections/0/educationEntries/0/highlights/-            追加到末尾
```

`id` 长什么样：由内容生成，`sec-工作经历`、`work-acme`、`pos-产品经理`。

网页版的「导出 JSON」已经把 id 从内容重写过了，所以从网页版导出的文件直接就是可读 id，
不需要额外操作。只有两种情况需要跑一次 `./bin/resume ids --in cv.json --rewrite`：
文档是别处来的（比如更早导出的旧文件），或者你在网页版里编辑过、又想保留可读 id。

**不要手改 id**：id 是给别处引用的地址。

一个需要注意的语义：`--rewrite` 出来的 id 是从内容派生的，所以**改了内容 id 就会变**
（改公司名 → `work-acme` 变成 `work-acme中国`），插入/删除条目也会让同名前缀的
编号位移。`get`/`patch`/`measure` 这些命令在读写文件时**不会**重写已有 id，
所以只要你不重新导出，一份文件里的 id 就是稳定的。跨多次导出长期保存 id，
请自己留一份 `get --out work.json` 的副本并在它上面工作。

### patch

```jsonc
[
  { "op": "replace", "path": "/personal/summary", "value": "…" },
  { "op": "add", "path": "/sections/0/workEntries/-", "value": { /* 完整条目 */ } },
  { "op": "remove", "path": "/sections/0/workEntries/work-globex" },
  { "op": "move", "from": "/sections/0/workEntries/work-globex", "path": "/sections/0/workEntries/0" },
  { "op": "test", "path": "/personal/name", "value": "张三" }
]
```

- 整个 patch 是原子的：有一个操作失败就一个都不落盘，文件保持原样。
- `replace` / `remove` 的目标必须已存在——**拼错字段名会报错，而不是新建一个字段**。
- 找不到 id 时，报错会把该数组里可用的 id 全列出来，照着改就行。
- `add` 到数组的索引位置是**插入到该位置之前**，`-` 才是追加。

一个常见的坑：编辑器新建条目时 `highlights` 是 `[""]`，也就是第 0 条是空占位符。
想加一条先看 `get` 出来的实际内容，别默认 `highlights/0` 就是第一条真实战绩。

### measure

`measure` 在一个无头 Chromium 里加载**和网页预览同一份标记、同一份 CSS**
（`src/lib/html.ts` + `base.css` + `a4.css`），量的是真实排版，不是估算。

```jsonc
{
  "ok": true,
  "pageHeightPx": 1123, "pageHeightMm": 297.1,      // A4 一页
  "contentHeightPx": 1340, "contentHeightMm": 354.5,
  "fillRatio": 1.194,       // 1 = 正好一页；1.194 = 超出一页 19.4%
  "fitScale": 1,            // 物理字号始终不缩放；超页必须解决
  "pages": 2,               // 不缩放的话需要几页
  "fontSizePt": 11,
  "warnings": ["内容超出 A4 一页 19%，导出时会缩放到 84% 才塞得下。"],
  "hotspots": [             // 按占用高度从大到小，帮你决定砍哪里
    { "path": "/sections/0", "id": "sec-工作经历", "title": "工作经历", "heightPx": 412, "share": 0.31 }
  ]
}
```

`hotspots[].path` 可以直接当 `patch` 的路径用。

判读阈值：

- `fillRatio > 1` —— 内容超页。系统不会自动缩小；网页会阻止导出，CLI 会报 `clipped: true`。
- `fitScale` 固定为 `1`，表示 PDF 中的物理字号和预览相同。
- `fillRatio < 0.75` —— 偏空，提示你还有空间可以补充。

闭环用法：改内容 → `measure` → 看 `warnings` 和 `hotspots` 决定砍哪一段或调
`/fontSizePt` → 再 `measure`。别跳过中间这步。

### render

```bash
./bin/resume render --in cv.json --format docx --out cv.docx
./bin/resume render --in cv.json --format pdf  --out cv.pdf
```

`--out` 省略时用 `<姓名>_<日期>.<扩展名>`；`--out -` 把产物写到 stdout（适合直接管道给下一步）。

**PDF 是在真实浏览器里打出来的**，和 `measure` 用同一个引擎、同一份标记与 CSS。
文档内部永远按 100% 物理字号排版，预览只在 A4 纸张外层做视口缩放。所以 PDF 和网页预览**像素级一致**
（CI 之外的验证方式见下）。输出信封：

```jsonc
{
  "ok": true, "path": "/abs/cv.pdf", "bytes": 411296, "format": "pdf",
  "pages": 1,          // 实际写进文件的页数（从 PDF 里读出来的，不是推算的）
  "fitRatio": 1.202,   // 内容原始高度 ÷ 一页
  "fitScale": 1,       // 文档固定 100% 输出
  "clipped": false,    // true = 内容超出 A4，见下
  "browser": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
}
```

**`clipped` 是你要盯的字段。** 规则和网页预览完全一样：

- 内容不超页 → 按设定字号 100% 输出，`clipped: false`。
- 内容超一页 → 不缩小，**超出的部分被裁掉**，`clipped: true`，同时 stderr 说明必须先精简内容或降低字号。
- 永远不会出现「预览一页、导出三页」这种情况：PDF 的页数恒为 1。

所以出 PDF 之前的正确姿势还是先 `measure`，看 `hotspots` 决定砍哪里，再出稿。

### import（Markdown → JSON）

只合并**章节**。个人信息、`fontSizePt`、`fontFamily`、`headerAlignment`、`photo`、`show*` 开关一律不动——Markdown
不携带它们，所以它永远不能当事实源。

对齐规则是**按位置**：Markdown 里第 n 个章节对应文档里第 n 个**可见**章节，
并且类型要一致；类型不一致就当新章节追加，并在 `warnings` 里说明。文档里有、
Markdown 里没有的章节保持原样（Markdown 不支持删章节，删用 `patch`）。

由此带来一个必须知道的后果：**在 Markdown 里插入或删除条目，会让它后面的条目
id 发生位移**（第 n 个位置继承了原来的 id）。要 id 稳定就用 `patch`。

---

## 已知限制

- **Markdown 视图不含**：`photo`、`fontSizePt`、`show*` 开关、隐藏章节、
  `certId`、`honorsLabel`、各条目的 `url`。
- **字符串数组（`highlights`、`honors`、`courses`、`skills`）没有 id**，只能按索引寻址。
- `validate` 的 error 只有两类会 fail：`duplicate-id` 和 `missing-id`（它们会破坏寻址）。
  其余都是 warning——内容问题不该拦住你写文件，但应该在收尾前清掉。

---

## 改简历时的约定

1. 收尾前跑 `validate`，把 warning 清干净；`empty-highlight`、`toggle-without-content`
   这类是最常见的「看起来写了其实不显示」。
2. 动过内容就跑 `measure`，并用它的 `hotspots` 决定砍哪里，而不是凭感觉删句子。
3. 小步 `patch`，不要整篇重写 JSON：整篇重写会丢掉 id 和 `photo` 这类你不容易注意到
   的字段。
4. 不要手改 id，不要在别处引用 id 后又去 `--rewrite`。
5. `get` / `validate` / `measure` 的 stderr 提示是给你读的，不是噪音。

---

## 实现位置

| 路径 | 作用 |
| --- | --- |
| `cli/index.ts` | 命令分发、参数、输出信封 |
| `cli/measure.ts` | 无头浏览器测量 |
| `cli/pdf.ts` | 无头浏览器打印 PDF |
| `cli/browser.ts` | 浏览器启动、文档加载与等待、几何读取（measure 与 pdf 共用） |
| `cli/paths.ts` | 样式文件与 Chromium 可执行文件的发现 |
| `src/lib/a4.ts` | A4 尺寸常量、预览缩放边界与「适应宽度」的取整 |
| `src/lib/html.ts` | **唯一的排版实现**：`ResumeState` → A4 标记 |
| `src/lib/ids.ts` | 确定性 id |
| `src/lib/patch.ts` | JSON Pointer + id 寻址的 patch |
| `src/lib/resumeSchema.ts` | 规范化与校验 |
| `src/lib/markdownMerge.ts` | Markdown 合回 JSON |
| `src/components/PreviewA4.tsx` | 网页预览，渲染 `src/lib/html.ts` 的输出 |

网页预览、`measure`、将来的 PDF 都走 `src/lib/html.ts` 这一份实现。改排版时
请改它和 `src/styles/a4.css`，不要再写第二份渲染逻辑——一旦两处不一致，
`measure` 的数字就没有意义了。

预览的缩放（`.preview-viewport .a4-page { zoom }`）只是**看**的倍数，不参与布局：
纸张在布局上永远是 210mm 宽（`.a4-page { flex: none }`），所以屏幕上的断行和打印
一致，`zoom` 只决定你能看到多少。文档内部不使用 `transform: scale()`；
`measure` 的 `fitScale` 固定为 1，仅作为向后兼容字段。
