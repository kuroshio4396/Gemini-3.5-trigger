# Gemini-3.5-trigger · PromptRefine AI

> **图片反推提示词工作台** —— 把一张图（或一段文字）拆解成可直接粘进 ComfyUI / Stable Diffusion 的**中英双语结构化标签**，按 `画风 / 人物 / 动作 / 环境 / 构图` 五类归档，并支持批量导出 `lora-scripts` 可直接训练的同名 caption。

![Status](https://img.shields.io/badge/status-active-success)
![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20Vite%206%20%2B%20Vercel-61dafb)
![Providers](https://img.shields.io/badge/providers-Gemini%20%7C%20OpenRouter%20%7C%20Kimi-8b5cf6)
![Language](https://img.shields.io/badge/lang-TypeScript-3178c6)
![License](https://img.shields.io/badge/license-未指定-lightgrey)

🔗 **在线演示**：<https://gemini-3-5-trigger.vercel.app>

> ⚠️ **演示站需要自备 API Key。** 部署环境未配置服务端 `GEMINI_API_KEY`，用空 Key 提交会直接返回 500。详见 [常见问题](#常见问题)。

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [界面结构](#界面结构)
- [三种输入方式](#三种输入方式)
- [三个功能开关](#三个功能开关)
- [五大标签分类](#五大标签分类)
- [API 服务商与模型](#api-服务商与模型)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [部署](#部署)
- [API 说明](#api-说明)
- [项目结构](#项目结构)
- [数据与隐私](#数据与隐私)
- [使用技巧](#使用技巧)
- [配套工具](#配套工具)
- [常见问题](#常见问题)
- [已知限制与工程遗留](#已知限制与工程遗留)
- [版本历史](#版本历史)
- [许可证](#许可证)

---

## 项目简介

**PromptRefine AI** 是一个纯前端的「图像问答器」（interrogator）——上传一张图，它用多模态大模型把画面拆成结构化的提示词标签；也可以只给一段文字描述，让它补齐成完整标签集。

它解决的问题很具体：**训练 LoRA / 复现画风时，手工写提示词既慢又容易漏维度。** 这个工具把「看图 → 拆解 → 分类 → 中英对照 → 导出」压成一次点击，并且输出格式直接对齐 ComfyUI 与 `lora-scripts` 的 caption 约定。

三个设计选择决定了它的性格：

- **五分类固定结构，而不是一坨自由文本。** 模型被强制按 `style / character / action / environment / composition` 五个键返回，每项是 `{en, zh}` 对象数组。结构由 Gemini 的 `responseSchema` 原生约束，不靠提示词祈祷。
- **中英双语并列。** 英文是能直接用的 tag，中文是同义的翻译——便于核对、检索与二次改写。
- **一份代码，两种运行形态。** 本地跑是 Express + Vite 中间件（`server.ts`），部署到 Vercel 则是 Serverless 函数（`api/analyze.ts`）。两者共用同一个 `/api/analyze` 契约。

> **关于仓库名**：`Gemini-3.5-trigger` 来自设置弹窗里模型下拉框的第一项 `Gemini 3.5 Flash`。项目本身**不只支持 Gemini**——它还支持 OpenRouter 与 Kimi / Moonshot 两条通道，见 [API 服务商与模型](#api-服务商与模型)。

---

## 核心特性

| 特性 | 说明 |
|---|---|
| 🖼️ **图片反推** | 上传 / 拖拽单张图片，自动分析并输出五类标签 |
| ⌨️ **文本反推** | 不给图，只给一段文字描述，同样产出五类标签（走同一接口的 `textInput` 分支） |
| 📦 **批量处理** | 一次选多张图，串行逐张反推，带逐文件状态与进度 |
| 🗜️ **ZIP 导出** | 批量结果打包下载，每张图一个**同名 `.txt`**，内容为单行英文标签串 |
| 🌏 **中英对照** | 每个标签同时给出 `en`（可直接用于 ComfyUI）与 `zh` 翻译 |
| 📋 **一键复制** | 单个标签点一下复制；单类整串复制；全部分类合成串复制；支持 EN / 中文切换 |
| 🎛️ **三个改写开关** | 多人内容识别 / Anima 模式 / R18+ 词汇过滤，可叠加 |
| ✍️ **附加提示词指导** | 自由填写额外要求（如「侧重描述服饰」），会作为最高优先级指令追加 |
| 🔌 **四家服务商** | Google AI Studio（默认）/ OpenRouter / Kimi / Kimi 开放平台 |
| 💾 **配置持久化** | 服务商、Key、模型存在 `localStorage`，刷新不丢 |
| 🚀 **零后端依赖（前端）** | 无数据库、无账号、无用户体系；后端只做一次模型转发 |

---

## 界面结构

单屏三区布局，左侧是输入与配置，右侧是结果：

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📷 PromptRefine AI            ● 多人内容识别  ● Anima模式  ● R18+ 词汇过滤     │
│    ComfyUI Image-to-Prompt…        Model: gemini-2.5-flash      [API 配置]    │
├────────────────────────┬─────────────────────────────────────────────────────┤
│  INPUT SOURCE          │  RESULTS                                            │
│  ┌────┬────┬─────┐     │  ┌──────────────────┬──────────────────┐            │
│  │图片│文本│批量 │     │  │ ● 画风提示词      │ ● 人物提示词      │            │
│  └────┴────┴─────┘     │  │   Art Style      │   Character      │            │
│  ┌────────────────┐    │  │  [tag][tag][tag] │  [tag][tag]      │            │
│  │                │    │  └──────────────────┴──────────────────┘            │
│  │  Upload        │    │  ┌──────────────────┬──────────────────┐            │
│  │  Reference     │    │  │ ● 动作提示词      │ ● 环境提示词      │            │
│  │                │    │  │   Action         │   Environment    │            │
│  │  JPG PNG WebP  │    │  └──────────────────┴──────────────────┘            │
│  └────────────────┘    │  ┌─────────────────────────────────────┐            │
│                        │  │ ● 构图提示词  Composition            │            │
│  附加提示词指导 (可选)   │  └─────────────────────────────────────┘            │
│  ┌────────────────┐    │  ┌─────────────────────────────────────┐            │
│  │ 例如：侧重描述   │    │  │ EXPORT OPTIONS   [EN|中文]          │            │
│  │ 人物服饰…       │    │  │        [ Export to ComfyUI Workflow ]│            │
│  └────────────────┘    │  └─────────────────────────────────────┘            │
│  ┌────────────────┐    │                                                     │
│  │ PROCESSING     │    │                                                     │
│  │ STATS          │    │                                                     │
│  │ 分类 5 | 标签 94│    │                                                     │
│  └────────────────┘    │                                                     │
└────────────────────────┴─────────────────────────────────────────────────────┘
```

要点：

- **左栏固定 340px**，可独立纵向滚动；右栏吃掉剩余空间。
- **结果区是 2×3 网格**，`构图` 一格横跨两列（`col-span-2`），因为构图类标签通常最长。
- **顶栏三个开关**用颜色区分状态：多人识别=琥珀、Anima=紫、R18 过滤=玫瑰红，与结果区分类色卡同源。
- 处理完成后左栏会出现一块深色 **Processing Stats**，显示分类数（恒为 5）与标签总数。

---

## 三种输入方式

左栏 `INPUT SOURCE` 的三个页签切换：

| 页签 | 输入 | 说明 |
|---|---|---|
| **图片** | 拖拽或点击上传单张图 | 上传即自动开始分析，无二次确认。`accept="image/*"`，前端不设体积限制（后端有限制，见 [API 说明](#api-说明)）。分析时图片上覆盖「Analyzing Image...」遮罩，完成后可点 `Replace Reference Image` 换图 |
| **文本** | 多行文本描述 | 走同一个 `/api/analyze`，只是不带 `image` 而带 `textInput`。适合「先有构想、要提示词」的场景。描述为空时按钮禁用 |
| **批量** | 多选图片 | 见 [配套工具](#配套工具) 与下方说明 |

**批量模式的行为细节**（值得先知道，能省很多时间）：

- **严格串行**：`for` 循环里 `await` 逐张处理，不并发。这是有意的——并发会同时占用多个上游配额，更容易触发限流与 `maxDuration`。
- **可断点续跑**：已 `success` 的文件会被 `continue` 跳过。所以中途失败时，**直接再点一次「开始批量反推」即可**，成功的不重复消耗额度。
- **单张失败不影响其他**：每张独立 `try/catch`，失败项标红并把错误文案挂在标题上（hover 可见），其余继续。
- **ZIP 内容需注意**：包内每个 `.txt` 用**原图去扩展名**命名（`photo.jpg` → `photo.txt`），内容是按 `画风 → 人物 → 动作 → 环境 → 构图` 顺序取**全部 `en`** 用 `", "` 拼接的**单行**字符串。**没有 BOM、没有尾换行。**
- **ZIP 里没有图片**，只有 txt；且只打包 `success` 的文件。

---

## 三个功能开关

顶栏三个按钮，本质都是往提示词尾部追加一段 `CRITICAL INSTRUCTION`：

### 多人内容识别（Multi-Character Mode）

要求模型**逐个独立识别**画面中的每个人物，并把该人物的所有特征（服装、发型、外貌）**合并成一条长标签**塞进 `character` 分类。

效果对比：

| 关闭 | 开启 |
|---|---|
| `1girl`、`blonde hair`、`blue dress`（拆成多条，无法区分属于谁） | `1girl, blonde hair, blue dress` 与 `1boy, black hair, suit`（每人一条长标签） |

**多人图必须开**，否则不同人物的特征会混在一起无法归因。

### Anima 模式（Anima Mode）

**放弃逗号短标签，改输出自然语言长句**：

| 关闭 | 开启 |
|---|---|
| `1girl`、`blue sky`、`wind` | `A beautiful young woman standing under a clear blue sky, her blonde hair blowing gently in the wind...` |

适合需要连贯语义描述的场合（部分模型/工作流偏好自然语言 caption）。**注意**：开启后导出串会明显变长，中文翻译仍会对应给出。

### R18+ 词汇过滤（Filter R18）

要求模型**剔除**一切露骨、NSFW、R18+ 或敏感词汇，只输出能稳定通过安全检查的安全标签，同时尽量保留构图与非露骨特征。

**这不是「本地黑名单过滤」**——它是一条交给模型的指令，属于**尽力而为**：模型可能仍有遗漏。真正需要合规产出时，请自行复核结果。

### 附加提示词指导

左栏下方那块文本框，内容会以 `USER ADDITIONAL GUIDANCE` 追加，并被要求**严格遵守**。适用场景：

- `请侧重描述人物服饰与材质` —— 调整标签分布权重
- `将其风格转为赛博朋克` —— 做风格改写
- `背景再多描述一些`、`减少构图类标签` —— 控制各类详略

---

## 五大标签分类

模型输出被强制约束为五个固定键，每项是 `{en, zh}` 数组：

| 键 | 界面标题 | 覆盖内容（取自 Gemini `responseSchema` 的官方描述） | 色卡 |
|---|---|---|---|
| `style` | 画风提示词 / Art Style | 艺术风格、媒介、渲染方式、光照与视觉美学 | 蓝 |
| `character` | 人物提示词 / Character | 人物、主体、服装、发型、表情与身体特征 | 绿 |
| `action` | 动作提示词 / Action | 动作、姿势、互动与动态 | 琥珀 |
| `environment` | 环境提示词 / Environment | 背景、场景、风景、道具与地点 | 紫 |
| `composition` | 构图提示词 / Composition | 机位、取景、焦点、透视与画面布局 | 玫瑰 |

**响应结构**：

```json
{
  "style":       [ { "en": "anime style", "zh": "动漫风格" } ],
  "character":   [ { "en": "1girl",       "zh": "一个女孩" } ],
  "action":      [ { "en": "standing",    "zh": "站立" } ],
  "environment": [ { "en": "beach",       "zh": "沙滩" } ],
  "composition": [ { "en": "full body",   "zh": "全身" } ]
}
```

界面上的 `Export to ComfyUI Workflow` 按钮把这个结构按同样顺序拍平成一条 `", "` 分隔的串，可直接粘进 ComfyUI 的正向提示词框。

---

## API 服务商与模型

点击顶栏 `API 配置` 打开设置弹窗，可选四家服务商：

| 服务商 | 界面名称 | 可选模型 | 端点 |
|---|---|---|---|
| `google`（默认） | Google AI Studio | Gemini 3.5 Flash / Gemini 3 Flash / Gemini 3.1 Flash Lite / **Gemini 2.5 Flash**（默认） | `@google/genai` SDK 原生调用 |
| `openrouter` | OpenRouter | 同上四项 | `https://openrouter.ai/api/v1/chat/completions` |
| `kimi` | Kimi | Kimi K2.7 Code | `https://api.kimi.com/coding/v1/chat/completions` |
| `moonshot` | Kimi 开放平台 | Kimi K2.7 Code / Kimi K2.6 | `https://api.moonshot.cn/v1/chat/completions` |

默认配置（首次打开、`localStorage` 无记录时）：`{ apiProvider: 'google', apiKey: '', model: 'gemini-2.5-flash' }`

### 三条通道的实现差异（读代码才看得出来）

| | Google | OpenRouter | Kimi / Moonshot |
|---|---|---|---|
| **结构化约束** | 原生 `responseSchema`（`Type.OBJECT` + 五键 `required`）+ `responseMimeType: 'application/json'` | 只靠提示词里的 `jsonInstruction` + `response_format: { type: 'json_object' }` | 同左 |
| **安全设置** | 显式传入 4 条 `safetySettings`，全部 `BLOCK_NONE` | 不传，由 OpenRouter / Google 侧策略决定 | 不传，由 Kimi 侧策略决定 |
| **模型名处理** | 原样透传 | **强制加 `google/` 前缀** | 原样透传 |
| **传输方式** | SDK 一次性返回 | 一次性返回 | **`stream: true` 流式**，服务端逐块拼 `delta.content` |
| **超时** | 未显式设置 | 未显式设置 | 300 秒（`AbortController`） |

三点值得单独说明：

1. **OpenRouter 通道只能跑 Google 系模型。** 代码写死了 `const openRouterModel = \`google/${selectedModel}\``，所以哪怕你在下拉里选的是 Gemini，最终请求的是 `google/gemini-2.5-flash` 这类 OpenRouter 命名。想用 OpenRouter 上的其他模型，需要改这一行。
2. **Kimi 走流式是为了保活。** 注释写得很明确：Vercel 函数 `maxDuration` 默认较短，流式传输能让连接保持活跃，因此把超时放宽到 300 秒。对应的 `vercel.json` 里也把 `api/**/*.ts` 的 `maxDuration` 设为 300。
3. **Kimi 有图片格式白名单。** `MOONSHOT_IMAGE_TYPES` 只放行 JPEG / PNG / GIF / WebP / BMP / HEIC / HEIF，**SVG 会被直接拒绝**并返回明确错误——这是 Moonshot 官方文档的限制，不符合格式时前端会先收到一个可读的中文报错，而不是上游的模糊失败。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | React 19（`StrictMode`） |
| 语言 | TypeScript 5.8（`noEmit` 纯类型检查，`jsx: react-jsx`） |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 4（通过 `@tailwindcss/vite` 插件，`@import "tailwindcss"` + `@theme` 变量） |
| UI 图标 | lucide-react |
| 动画 | motion（`motion/react`，用于结果区淡入与拖拽区缩放反馈） |
| 打包 | JSZip（批量导出 ZIP） |
| 本地服务 | Express 4 + `tsx`（开发）/ `esbuild` 打成 CJS（生产） |
| 模型 SDK | `@google/genai`（Gemini 原生通道） |
| 部署 | Vercel（`api/` 目录当 Serverless Functions） |

**字体说明**：`src/index.css` 里声明了 `--font-sans: "Inter"` 与 `--font-mono: "JetBrains Mono"`，但 `index.html` **没有引入任何 Web Font**，因此实际渲染会回落到 `system-ui`。如果你希望真的用上 Inter，需要自行补 `<link>`。

---

## 快速开始

### 环境要求

- **Node.js 18+**（`esbuild --platform=node` 与 Vite 6 的最低要求）
- **npm**
- 一个可用的 API Key：Gemini（Google AI Studio）**或** OpenRouter **或** Kimi / Moonshot

### 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置服务端 Key（可选 —— 见下方说明）
cp .env.example .env
# 编辑 .env，填入 GEMINI_API_KEY

# 3. 启动开发服务器
npm run dev
# → http://localhost:3000
```

`npm run dev` 实际执行的是 `tsx server.ts`：同一个进程里既起 Express、又用 Vite 的 **middleware 模式**接管前端资源与 HMR，所以**开发时不需要另开一个前端端口**。

### 可用的 npm 脚本

| 脚本 | 命令 | 用途 |
|---|---|---|
| `dev` | `tsx server.ts` | 开发服务器（Express + Vite 中间件），端口 **3000** |
| `build` | `vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` | 先构建前端到 `dist/`，再把服务端打成 `dist/server.cjs` |
| `start` | `node dist/server.cjs` | 以生产模式运行（需先 `build`，且 `NODE_ENV=production` 才会走静态托管分支） |
| `preview` | `vite preview` | 仅预览前端产物（**不含 `/api/analyze`**，接口会 404） |
| `lint` | `tsc --noEmit` | 全量类型检查，不产出文件 |
| `clean` | `rm -rf dist server.js` | 清理产物（见 [工程遗留](#已知限制与工程遗留)） |

### 环境变量

`.env.example` 里有两个：

| 变量 | 必填 | 说明 |
|---|---|---|
| `GEMINI_API_KEY` | 否 | 服务端兜底 Key。**仅在「服务商 = Google AI Studio 且用户在界面里没填 Key」时才会被使用**。想让部署实例开箱即用就配它 |
| `APP_URL` | 否 | 应用自身 URL。目前只被 OpenRouter 分支用作 `HTTP-Referer` 头，默认 `http://localhost:3000` |

> **Key 的优先级**：请求体里的 `apiKey`（界面填的）**优先于** `process.env.GEMINI_API_KEY`。两者都为空时，接口返回 500 并提示「未配置 API Key」。

---

## 部署

### Vercel（推荐，也是当前演示站的形态）

1. 把仓库导入 Vercel。
2. 在 **Settings → Environment Variables** 里配置 `GEMINI_API_KEY`（**不配也能部署，但访客必须自备 Key**）。
3. 构建配置全部由 `vercel.json` 决定，无需手改：

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": { "maxDuration": 300 }
  }
}
```

- 第一条 rewrite 让 `/api/*` 落到 `api/` 目录下的 Serverless Function；
- 第二条是 SPA 兜底，保证前端路由刷新不 404；
- `functions` 段把函数超时提到 300 秒——和 Kimi 通道的 300 秒超时是配套的。

### 自建 / 其他平台

```bash
npm run build
NODE_ENV=production npm start
```

`server.ts` 会读 `NODE_ENV`：非 `production` 走 Vite 中间件（开发态），`production` 则 `express.static(dist)` + 通配路由回 `index.html`。**所以自建时务必显式设置 `NODE_ENV=production`**，否则会去加载 Vite 开发中间件。

> ⚠️ **已实测的部署陷阱**：`api/analyze.ts` 用的是 Vercel 风格的 `(req, res)` 处理器签名，**不能直接搬去 Netlify / Cloudflare Workers**；那类平台需要改写入口。要在国内网络访问，注意该站需要能连通 Google / OpenRouter / Moonshot 上游。

---

## API 说明

唯一的接口：**`POST /api/analyze`**

- 本地：`http://localhost:3000/api/analyze`（Express，`express.json({ limit: '50mb' })`）
- 线上：`https://<your-domain>/api/analyze`（Vercel Function，`maxDuration: 300`）

### 请求体

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `image` | `string` | 二选一 | — | 完整 data URL，形如 `data:image/png;base64,...`。服务端会剥掉前缀取 base64 |
| `textInput` | `string` | 二选一 | — | 纯文本描述。与 `image` 二选一，两者都缺返回 400 |
| `mimeType` | `string` | 传图时建议 | — | 图片 MIME。Kimi 通道会用它做白名单校验 |
| `apiProvider` | `string` | 否 | `google` | `google` / `openrouter` / `kimi` / `moonshot` |
| `apiKey` | `string` | 否 | `''` | 空则回落到服务端 `GEMINI_API_KEY`（仅 Google 通道） |
| `model` | `string` | 否 | `gemini-2.5-flash` | 模型名 |
| `filterR18` | `boolean` | 否 | `false` | 追加 R18 过滤指令 |
| `multiCharacterMode` | `boolean` | 否 | `false` | 追加多人识别指令 |
| `animaMode` | `boolean` | 否 | `false` | 追加自然语言长句指令 |
| `additionalPrompt` | `string` | 否 | — | 用户附加指导，追加为 `USER ADDITIONAL GUIDANCE` |

### 成功响应

HTTP `200`，直接就是五键对象（**没有外层包装**）：

```json
{
  "style":       [ { "en": "...", "zh": "..." } ],
  "character":   [ { "en": "...", "zh": "..." } ],
  "action":      [ { "en": "...", "zh": "..." } ],
  "environment": [ { "en": "...", "zh": "..." } ],
  "composition": [ { "en": "...", "zh": "..." } ]
}
```

### 错误响应

统一形如：

```json
{ "error": "Failed to analyze image", "details": "<可读的中文/英文原因>" }
```

| 状态码 | `details` 关键内容 | 触发条件 |
|---|---|---|
| `400` | `Missing image data or text input` | `image` 与 `textInput` 都为空 |
| `405` | `Method Not Allowed` | 用了非 POST 方法 |
| `413` | 前端会转成「请求体超过 Vercel 函数 4.5MB 限制…」 | 请求体超出平台上限（**这颗由平台拦，不进函数逻辑**） |
| `500` | `未配置 API Key。请在设置中配置您的 API Key…` | 界面 Key 与服务端 `GEMINI_API_KEY` 都为空 |
| `500` | `未配置 OpenRouter API Key…` / `未配置 Kimi API Key…` | 选了对应服务商但 Key 为空 |
| `500` | `图片体积过大（base64 数据约 X MB）。Vercel 函数请求体上限为 4.5MB…` | base64 长度 > 4,000,000（**这道是函数内预检，先于调用上游**） |
| `500` | `Kimi 开放平台不支持图片格式 image/svg+xml…` | Kimi 通道遇到白名单外的 MIME |
| `500` | `Kimi API 请求超时（300 秒）。请重试或换用高速版模型。` | Kimi 通道 300 秒未返回 |
| `500` | `模型返回内容不是合法 JSON（finish_reason: …）` | 模型没按契约吐 JSON（含被截断） |
| `500` | `Image analysis blocked by safety filters. Please try another image.` | Gemini 侧 `finishReason === 'SAFETY'`，返回体为空 |
| `500` | `OpenRouter Error: …` / `Kimi API 错误 (4xx): …` | 上游报错，原文透传 |

### 调用示例

**文本反推（最省额度的自检方式）**：

```bash
curl -X POST https://gemini-3-5-trigger.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "textInput": "a girl standing on a beach at sunset",
    "apiProvider": "google",
    "apiKey": "YOUR_KEY",
    "model": "gemini-2.5-flash"
  }'
```

**图片反推（Python，含 base64 组装）**：

```python
import base64, json, urllib.request

with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

payload = {
    "image": f"data:image/jpeg;base64,{b64}",
    "mimeType": "image/jpeg",
    "apiProvider": "google",
    "apiKey": "YOUR_KEY",
    "model": "gemini-2.5-flash",
    "multiCharacterMode": False,
    "animaMode": False,
    "filterR18": False,
    "additionalPrompt": "",
}

req = urllib.request.Request(
    "https://gemini-3-5-trigger.vercel.app/api/analyze",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
)
print(json.loads(urllib.request.urlopen(req, timeout=180).read()))
```

> **图片体积红线**：函数内预检的阈值是 **base64 长度 4,000,000 字符**（约 3.8 MB 原始字节）。但 Vercel 的请求体上限是 **4.5 MB**，而 JSON 里还有别的字段——**实践上建议原图压在 3 MB 以内、长边不超过 4K**。超限时前端会提示压缩后重试。

---

## 项目结构

```
Gemini-3.5-trigger/
├── api/
│   └── analyze.ts              # Vercel Serverless 版 /api/analyze（自包含，含全部三家通道）
├── assets/
│   └── .aistudio/              # AI Studio 模板目录（仅一个 .gitignore）
├── src/
│   ├── components/
│   │   ├── ImageUploader.tsx   # 单图上传/拖拽 + 预览 + 分析中遮罩
│   │   ├── BatchProcessor.tsx  # 批量队列、串行处理、ZIP 导出
│   │   ├── PromptResults.tsx   # 五分类色卡网格 + 复制/导出栏
│   │   └── SettingsModal.tsx   # 服务商 / Key / 模型的配置弹窗
│   ├── App.tsx                 # 布局、状态中枢、两次 fetch 调用、三个开关
│   ├── types.ts                # Tag / PromptData / AppSettings / categoryLabels
│   ├── index.css               # Tailwind 入口 + @theme 字体变量 + 自定义滚动条
│   └── main.tsx                # React 挂载点
├── index.html                  # SPA 外壳
├── server.ts                   # 自建/开发用 Express 服务（含 /api/analyze 的本地实现）
├── metadata.json               # AI Studio 元数据（名称/描述/能力声明）
├── vercel.json                 # rewrites + functions.maxDuration
├── vite.config.ts              # React + Tailwind 插件、@ 别名、HMR 开关
├── tsconfig.json               # ES2022 / bundler 解析 / noEmit
├── package.json
└── .env.example
```

### 架构要点

**1. `server.ts` 与 `api/analyze.ts` 是同一份逻辑的两份拷贝。**

实测两份文件整体相似度 **93.8%**，其中 `/api/analyze` 的业务体相似度 **95.7%**。它们各自完整实现了一遍三家服务商的分支、提示词拼装、体积预检与错误处理。

这是**本仓库最大的维护风险**：改提示词、加服务商、调超时，**必须同时改两处**，否则本地能用、线上不能（或反过来）。新增逻辑时建议先抽公共模块，或明确约定「以 `api/analyze.ts` 为准」并在 `server.ts` 里改为复用。

**2. 提示词是「运行时字符串拼接」。**

`promptText` 先按图片/文本分支取基础模板，再依次追加 `additionalPrompt` → `filterR18` → `multiCharacterMode` → `animaMode`。顺序即优先级，**附加指导排在最前**，四个开关全部关闭时就是最干净的基础模板。想调整措辞直接改这段字符串即可，没有独立的 prompt 文件。

**3. Gemini 通道用原生 Schema 而不是靠提示词。**

只有 Google 分支传了 `responseSchema`（含五键 `required`）与 `responseMimeType: 'application/json'`。OpenRouter 与 Kimi 通道拿不到这个能力，只能靠 `jsonInstruction` 文案 + `response_format: { type: 'json_object' }` 约束，因此**对模型的指令遵循能力更敏感**——同样的图，换通道后格式出错概率会上升。解析侧统一由 `parseModelJson()` 兜底（先剥 ```json 围栏，失败时报 `finish_reason` 与内容开头 120 字符）。

---

## 数据与隐私

**这个工具会把你的图片送到第三方模型服务商。** 使用前请明确以下几点：

| 项目 | 实际情况 |
|---|---|
| **图片去向** | 以 base64 内联进请求体，**经你部署的服务端转发**给 Gemini / OpenRouter / Kimi 上游。服务端本身**不落盘、不写日志文件**（只在出错时 `console.error` 到函数日志） |
| **API Key 存放** | 存在浏览器 `localStorage` 的 `promptrefine_settings` 键下，**明文**。同浏览器同域名的任何脚本都能读到 |
| **Key 传输** | 每次请求都会把 Key 放进请求体发给服务端。**服务端不存储**，但会出现在平台日志可捕获的范围内（当前代码未打印请求体，但这是需要留意的边界） |
| **服务端日志** | 出错路径会 `console.error('Error analyzing image:', error)` —— 在 Vercel 上会进 Functions 日志 |
| **账号体系** | 无。没有用户、没有数据库、没有统计上报 |
| **前端持久化** | 只有 `promptrefine_settings` 一项。反推结果**不保存**，刷新即丢 |
| **同步到服务器** | 无 |

**共用部署实例的注意事项**：如果多人使用同一个部署，且部署方配置了服务端 `GEMINI_API_KEY`，那么所有人都在消耗**同一个**额度。

**安全设置的已知事实**：只有在 **Gemini 原生通道**下，代码会显式传入四条 `safetySettings`，类别为 `HATE_SPEECH` / `HARASSMENT` / `SEXUALLY_EXPLICIT` / `DANGEROUS_CONTENT`，阈值全部为 `BLOCK_NONE`。之所以如此，是因为这是模型训练向工具，过严的拦截会让大量正常图片拿不到标签。**但请注意：这不代表你可以突破上游服务商的使用条款**——各家条款与区域法规依然独立适用，OpenRouter 与 Kimi 通道也不受这段设置影响（它们不传 `safetySettings`）。请在你自己的合规框架内使用。

**建议**：把它当**本地/个人工具**用；不要用主账号的长期 Key，改用可随时吊销的独立 Key；不要把公开部署的地址当公共服务分发。

---

## 使用技巧

1. **先跑文本模式自检。** 想确认 Key 有效、通道通畅，用文本模式发一句 `a girl standing on a beach` 最快——不消耗图片额度，也能验证五键结构是否正常返回。
2. **多人图必开「多人内容识别」。** 否则 `1girl` 与 `1boy` 的特征会混在一个数组里，无法归因到具体人物。
3. **`构图` 类容易偏少。** 如果结果里构图标签稀疏，用附加指导补一句「请更详细描述机位与取景」。
4. **批量中途失败不用重头跑。** 已成功的会被跳过，直接再点一次「开始批量反推」。
5. **大图先压再传。** 长边 2048、质量 85 通常足够反推，且能大幅降低 413 风险。批量模式尤其值得先压——省时间也省配额。
6. **导出的 ZIP 可直接喂 `lora-scripts`。** 同名 `.txt` + 单行标签串正是训练 caption 的约定格式（该工具默认导出**纯英文**串，若需要中文串需自行改 `generatePromptText`）。
7. **复制粒度有三层。** 单标签点一下 → 单分类右上 `Copy` → 底部 `Export to ComfyUI Workflow`（全部合成一串）。底部还有个 `EN / 中文` 切换，决定复制的是哪一列。
8. **换通道能救格式。** 某个模型总是吐不出合法 JSON 时，换 Google 原生通道成功率最高——因为它有 `responseSchema` 硬约束。

---

## 配套工具

这个仓库是「提示词流水线」里的**生成端**，和作者另一个仓库构成完整链路：

| 工具 | 职责 | 仓库 |
|---|---|---|
| **Gemini-3.5-trigger**（本仓库） | 反推 —— 图/文 → 五分类中英标签 | 你在这里 |
| **ComfyUI 提示词归档助手** | 归档 —— 五分类标签 → 浏览器 IndexedDB，带预览图与 Excel 导入导出 | <https://github.com/kuroshio4396/ComfyUI-> |

两边产出的数据结构**完全一致**（都是 `style / character / action / environment / composition` 五个键、每项 `{en, zh}`），所以可以「本仓库反推 → 手动搬进归档库」，无需格式转换。

此外，同一套提示词框架还被移植成了 [WorkBuddy](https://www.workbuddy.cn/) 技能「**图片提示词反推**」，把「调用外部视觉 API」这一环换成会话自身的多模态能力，**不需要任何 API Key**，输出格式与本体保持一致。

---

## 常见问题

<details>
<summary><b>1. 打开演示站，上传图片后报「未配置 API Key」，但设置里写着「留空则使用内置 AI」？</b></summary>

<br>

**这是文案与实现的落差，以实测为准。**

设置弹窗底部写着：「如果服务商选择 Google AI Studio 且秘钥为空，则默认维持当前状态，由内置 AI 免费完成任务处理。」

但代码里的实际逻辑是：

```ts
const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
if (!finalApiKey) throw new Error('未配置 API Key。请在设置中配置您的 API Key，或在服务器部署环境中配置 GEMINI_API_KEY 环境变量。');
```

也就是说，「内置 AI」**依赖部署方在环境变量里配置 `GEMINI_API_KEY`**。经实测，当前线上演示站（`gemini-3-5-trigger.vercel.app`）**没有配置**该变量，因此用空 Key 提交会返回：

```
500 {"error":"Failed to analyze image","details":"未配置 API Key。请在设置中配置您的 API Key…"}
```

**解决办法**：点右上角 `API 配置`，填入你自己的 Gemini / OpenRouter / Kimi Key。或者自行部署并在 Vercel 配置 `GEMINI_API_KEY`。

</details>

<details>
<summary><b>2. 报「请求体超过 Vercel 函数 4.5MB 限制」或 HTTP 413？</b></summary>

<br>

图片太大了。两层限制：

- **Vercel 平台层**：请求体上限 **4.5 MB**，超了函数根本不会被调用，返回 413。
- **函数内预检**：剥离 data URL 前缀后的 base64 字符串长度超过 **4,000,000** 字符即主动抛错（提示里会带上实际 MB 数）。

因为 base64 会把体积放大约 **33%**，加上 JSON 包装开销，**原图建议压在 3 MB 以内、长边不超过 4K**。

压缩示例（Pillow）：

```python
from PIL import Image
im = Image.open("big.png")
im.thumbnail((2048, 2048))
im.convert("RGB").save("small.jpg", quality=85)
```

</details>

<details>
<summary><b>3. 报「模型返回内容不是合法 JSON」？</b></summary>

<br>

模型没有按契约返回 JSON。错误信息里会带上 `finish_reason` 与返回内容的前 120 个字符，先看这两项：

- **`finish_reason: MAX_TOKENS`** → 输出被截断，JSON 不完整。开启 Anima 模式后尤其容易发生（长句很占 token）。可换更长的模型或关掉 Anima。
- **返回内容是一段自然语言解释** → 模型没遵守格式指令。**换到 Google 原生通道**成功率最高，因为它有 `responseSchema` 强制约束。
- **返回内容为空** → 见下一条。

</details>

<details>
<summary><b>4. 报「Image analysis blocked by safety filters」？</b></summary>

<br>

上游模型侧的 `finishReason` 为 `SAFETY`，也就是**模型层面拒绝**了这次分析，返回体为空。

注意这与 R18 过滤开关**方向相反**：

- `R18+ 词汇过滤` 开启 = 让模型**更保守**地输出标签；
- 这条报错 = 模型**压根不愿意处理这张图**。

可以尝试：换一张图、换通道（OpenRouter 与 Kimi 不传 `safetySettings`，策略不同）、或换模型。**请勿**通过改写提示词、混淆输入等方式尝试绕过上游安全策略。

</details>

<details>
<summary><b>5. 选了 OpenRouter，但模型还是 Gemini？</b></summary>

<br>

**这是当前实现的既定行为，不是 bug。** 代码里写死了：

```ts
const openRouterModel = `google/${selectedModel}`;
```

所以 OpenRouter 通道实际上只能访问它的 `google/*` 系列。想用别的模型，需要改这一行（并自行处理模型名映射）。

顺带一提：从 Kimi / Kimi 开放平台切回其他服务商时，`SettingsModal` 会自动把模型重置为 `gemini-2.5-flash`，避免留下无效组合。

</details>

<details>
<summary><b>6. Kimi 通道报不支持某图片格式？</b></summary>

<br>

Kimi（Moonshot）开放平台只接受 **JPEG / PNG / GIF / WebP / BMP / HEIC / HEIF**，**SVG 会被拒绝**。这是上游的硬限制，代码里的 `MOONSHOT_IMAGE_TYPES` 白名单就是为了提前给你一个可读的中文报错。

转一下格式即可：SVG → PNG。

</details>

<details>
<summary><b>7. Kimi 通道报「请求超时（300 秒）」？</b></summary>

<br>

Kimi 通道走流式（`stream: true`）以保持连接活跃，超时上限设为 300 秒（与 `vercel.json` 里的 `maxDuration: 300` 配套）。

如果经常超时：换用标注为「高速版」的模型、压缩图片、或关掉 Anima 模式（它会让输出变长很多）。

</details>

<details>
<summary><b>8. 批量处理时点过一次，中途失败了，要重头再来吗？</b></summary>

<br>

**不用。** 已 `success` 的文件会被 `continue` 跳过，直接再点一次「开始批量反推」即可，只处理剩下的。

另外两点：批量是**严格串行**的（不并发），不会同时打满配额；单张失败只标红那一项、不影响其他，把鼠标悬停在红色错误文案上可以看到完整原因。

</details>

<details>
<summary><b>9. 导出的 ZIP 里有什么？能直接用于 LoRA 训练吗？</b></summary>

<br>

**只有 `.txt`，没有图片。** 每张成功处理的图对应一个**同名** txt：

- 文件名：原图去掉扩展名（`photo.jpg` → `photo.txt`）
- 内容：按 `画风 → 人物 → 动作 → 环境 → 构图` 顺序，取**全部 `en`** 用 `", "` 拼接成的**单行**字符串
- 编码：UTF-8，**无 BOM、无尾换行**

这正是 `lora-scripts` 等训练工具读取 caption 的约定格式，**可以直接用**。注意它导出的是**纯英文**串——如果需要中文 caption，要改 `BatchProcessor.tsx` 里的 `generatePromptText()`。

</details>

<details>
<summary><b>10. 我在界面填的 Key 会存到哪？安全吗？</b></summary>

<br>

存在浏览器 `localStorage` 的 **`promptrefine_settings`** 键下，**明文、不加密**。同域下任何脚本都能读到它。

每次发起反推时，Key 会随请求体发给服务端，服务端只用于当次调用上游、**不落盘**。但请注意这是**转发**而非浏览器直连上游，所以你的部署方（或平台日志）在理论上处于可信边界之内。

**建议**：用可随时吊销的独立 Key；不要在公共电脑上保存；用完可以到设置里清空。

</details>

---

## 已知限制与工程遗留

### 功能限制

| 限制 | 说明 |
|---|---|
| **演示站需自备 Key** | 部署环境未配置 `GEMINI_API_KEY`，空 Key 必 500。见 FAQ 第 1 条 |
| **浏览器直连上游被绕过** | 所有请求都先打到你部署的服务端。这是为了藏 Key 的设计，但也意味着**必须有一个能跑 Node 的后端**，纯静态托管跑不起来 |
| **服务端不落盘** | 无历史记录、无结果库。刷新页面结果即丢，**记得先导出** |
| **批量不支持并发** | 串行设计换来的是稳定性与可续跑，代价是速度。（实测参考：单张反推通常几十秒量级，20 张批量建议预留十几分钟） |
| **OpenRouter 只能用 Google 系模型** | `google/` 前缀写死 |
| **无 i18n** | 界面文案中英混排（按钮多为中文、标签页为英文），且**硬编码在组件里**，没有独立语言包 |
| **无测试** | 仓库里没有测试文件，`npm run lint` 只做类型检查 |

### 工程遗留（均为 AI Studio 模板残留，不影响功能）

| 项 | 现状 | 影响 |
|---|---|---|
| `index.html` 的 `<title>` | 仍是 **`My Google AI Studio App`** | 浏览器标签页与分享卡片显示错误标题——**这是最值得优先修的一处** |
| `package.json` 的 `name` | 仍是 `react-example` | 无功能影响，纯观感 |
| `clean` 脚本 | `rm -rf dist server.js` | `server.js` 并不存在（实际产物是 `dist/server.cjs`）；且 `rm -rf` 在 Windows 默认 shell 下不可用 |
| **`parseJsonBody()`** | 在 `server.ts` 与 `api/analyze.ts` 里**各定义了一次，两处都从未被调用** | 纯死代码（死代码约 10 行 ×2） |
| **`server.ts` 与 `api/analyze.ts` 高度重复** | 业务逻辑相似度实测 **95.7%** | **最大维护风险**：改一处忘另一处会导致本地/线上行为不一致 |
| `metadata.json` 的 `name` | `ComfyUI Image Prompt Reverse Engine`，与仓库名 `Gemini-3.5-trigger` 不一致 | AI Studio 侧显示名对不上 |
| `index.css` 声明的字体 | 声明了 `Inter` / `JetBrains Mono`，但页面**没有引入任何 Web Font** | 实际回落到 `system-ui`，设计意图未生效 |
| `src/components/ImageUploader.tsx` | props 签名声明了第三个参数 `previewUrl`，且调用处传了值，但 `App.tsx` 的处理函数只接收 `(base64, mimeType)` | 无害的签名不一致，属于重构残留 |
| `vite.config.ts` 第 16 行注释 | 存在编码乱码（`Do not modifyâ`） | 纯注释问题。疑为 AI Studio 导出时把 em dash 双重编码 |
| `assets/.aistudio/` | 只有一个 2 字节的 `.gitignore` | 模板目录残留，可保留可清理 |
| 未使用的依赖 | `dotenv`（仅 `server.ts` 用，属必要）；无确认的死依赖 | — |

> **本 README 不对上述项做任何代码改动**，仅作记录。其中改 `<title>` 的成本最低、收益最直接。

---

## 版本历史

从提交记录还原的真实演进（12 次提交，2026-06-27 → 2026-08-19）：

| 日期 | 提交 | 内容 |
|---|---|---|
| 2026-06-27 | `c7538f4` | Initial commit |
| 2026-06-27 | `52a85c0` | 初始化提示词反推应用 |
| 2026-06-27 | `c3e1da7` | 新增图片分析 API 与 Vercel 配置 |
| 2026-06-27 | `68f8bda` | 重构：统一 API Key 初始化方式 |
| 2026-07-02 | `b8d9586` | 支持**文本输入**；新增 **Kimi API** 通道 |
| 2026-07-03 | `9abeec9` | 新增**批量图片处理** |
| 2026-07-06 | `3d1b081` | 新增**标签点击复制** |
| 2026-07-06 | `40e3614` | 新增**多人内容识别模式** |
| 2026-08-04 | `c19b806` | 新增 **Anima 模式**；新增 **Moonshot 服务商** |
| 2026-08-04 | `2a22c93` | 修复：改进错误处理与响应解析 |
| 2026-08-04 | `c6e5209` | 构建：Vercel 函数超时提升到 **300s** |
| 2026-08-19 | `97e5962` | 新增**附加提示词指导**支持（当前 HEAD） |

---

## 许可证

**本仓库当前没有 `LICENSE` 文件**，因此默认按 **「保留所有权利」（All Rights Reserved）** 处理——未经版权所有者许可，他人无权复制、修改或再分发。

如果你想以开源方式分发，推荐补一个 `LICENSE` 文件：

1. 在仓库页点 **Add file → Create new file**；
2. 文件名填 `LICENSE`；
3. 右侧会出现 **Choose a license template**，选 **MIT**（宽松、最常用）或 **Apache-2.0**（含专利授权条款）；
4. 填好年份与版权人后提交。

> ⚠️ 注意：本项目的代码与提示词都**直接依赖第三方模型服务**（Google Gemini / OpenRouter / Moonshot）。无论本仓库选什么协议，**使用这些上游服务都必须遵守各家的服务条款**，开源许可不能豁免这一点。

---

## 致谢

- 脚手架与元数据体系来自 **Google AI Studio**（`metadata.json`、`assets/.aistudio/`、`aistudio-build` UA 均为其痕迹）；
- 模型能力由 **Google Gemini** / **OpenRouter** / **Moonshot Kimi** 提供；
- 界面依赖 **React**、**Vite**、**Tailwind CSS**、**lucide-react**、**motion**、**JSZip**；
- 提示词框架面向 **ComfyUI** 与 **Stable Diffusion / Illustrious** 生态设计；
- 配套归档工具：[ComfyUI 提示词归档助手](https://github.com/kuroshio4396/ComfyUI-)。

---

<div align="center">
<sub>PromptRefine AI · 把图变成提示词，把提示词变成可训练的数据</sub>
</div>
