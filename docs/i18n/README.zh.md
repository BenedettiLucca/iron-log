# Iron Log 🏋️‍♂️

> **零摩擦训练记录、身体追踪、数据分析与数据导出**

**Iron Log** 是一款完整的本地优先健身监控平台。为认真对待训练的人设计 — 快速记录负重、身体追踪、表现分析和数据导出。

**版本：** 3.13.0 · **Expo SDK：** 54 · **测试：** 385 项通过

---

## 🌍 支持语言

- 🇧🇷 **Português** (默认)
- 🇺🇸 **English**
- 🇪🇸 **Español**
- 🇨🇳 **简体中文**

可在 **设置** 中随时更改语言。

---

## 📱 功能

### 💪 训练与表现
- **训练会话管理** — 持久计时器、实时时长控制、动作间流畅切换
- **活动秒表** — 专用计时器，适用于时间型训练（平板、静挂）
- **专业休息计时器** — 智能休息计时器，后台运行
- **即时历史** — 不离开训练页面即可查看之前的负重记录
- **热身递进** — 自动计算热身组数量（40/60/80%）

### 🏋️ 训练计划与周期化
- **计划仪表盘** — 首页活跃计划卡片，显示每周训练量、平均 sRPE 和关键动作趋势指标
- **周完成网格** — 按周可视化完成情况（✅ 完成 / ❌ 缺席 / 💚 减载）
- **周详情** — 点击任意周查看该时段的训练记录
- **双递进** — 达到目标时自动追踪重量/次数递进
- **减载倒计时** — 仪表盘横幅显示距减载周的剩余周数

### 🧬 身体与进化
- **完整身体追踪** — 体重、身体尺寸和对比照片
- **进化图表** — 7 天移动平均值、按日期排序的照片廊
- **目标** — 设定体重和身体尺寸目标，并设置截止日期
- **每月提醒** — 可配置的检查提醒
- **月度打卡** — 照片并排对比（正面/背面/侧面），带测量数据叠加显示

### 📊 数据分析
- **Strength Score (0-100)** — 由训练量、强度、一致性组合的得分
- **等级：** 新手 → 初学者 → 中级 → 高级 → 精英
- **一致性** — 连续周数、每周/每月频率、总训练次数
- **训练量趋势** — 每周训练量图表（近 12 周）
- **顶级动作** — 进步最大的动作的负重进展
- **估算 1RM** — 使用 Epley 公式计算前 10 个最重动作
- **个人纪录** — 每个动作的自动 PR 追踪

### 📤 数据导出
- **CSV 导出** — 完整导出训练记录和身体数据
- **按次导出 CSV** — 从每次训练总结中单独导出
- **Notion Markdown 导出** — 导出单次训练，含 YAML frontmatter + 动作表格
- **周报** — 专用页面汇总本周训练、统计卡片和 Markdown 预览
- **原生分享** — 通过系统分享（微信、邮件等）
- **本地备份** — 导出/导入完整 SQLite 数据库（.db）
- **云端备份** — Google Drive（可选）

### 💊 补剂
- **每日清单** — 补剂打卡，含连续天数计数器和每周依从性
- **默认方案** — 一键导入肌酸、咖啡因+茶氨酸、D3、鱼油、甘氨酸镁、南非醉咖
- **自定义管理** — 添加/编辑/删除补剂，含剂量、时间、频率和表情符号

### 🛡️ 验证与稳定性
- **Zod Schemas** — 所有页面的路由参数和表单输入验证
- **Error Boundary** — 意外崩溃时的视觉回退
- **类型安全** — 代码库中零 `as any` 或 `useState<any>`
- **数据库加固** — WAL 模式、外键、索引、软删除

### 🎨 用户体验
- **"温暖土地色" 设计系统** — 圆角卡片、层级排版
- **动态主题** — 自动适配浅色/深色
- **骨架屏加载** — 加载时的动画占位符
- **触觉反馈** — 交互时的触感反馈
- **JSON 导入** — 粘贴结构化训练计划，应用自动创建训练方案

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **核心** | React Native (Expo SDK 54) + TypeScript |
| **ORM** | Drizzle ORM + SQLite (expo-sqlite) |
| **UI** | NativeWind v4 (Tailwind), Reanimated |
| **图表** | React Native Gifted Charts |
| **验证** | Zod |
| **测试** | Jest + ts-jest |
| **Lint** | ESLint (expo config) |

---

## 🚀 如何运行

```bash
# 安装依赖
npm install

# 生成数据库迁移
npx drizzle-kit generate

# 运行测试
npx jest

# 代码检查
npx expo lint

# 开发
npx expo start
```

### 生产构建 (Android)

由于 `android/` 目录已加入 `.gitignore`（不版本控制原生代码），请使用 Expo 工作流：

```bash
# 本地生成原生代码（用于调试）
npx expo prebuild --platform android

# 通过 EAS 构建（推荐）
npx eas build --platform android --profile production
```

如需生产版本使用 Google Drive 备份，请在 `.env` 中设置 `EXPO_PUBLIC_GOOGLE_CLIENT_ID`，并在 Google Cloud Console 中添加 keystore 的 SHA-1。

---

## 📂 项目结构

```
iron-log/
├── app/
│   ├── (drawer)/           # 侧边抽屉菜单
│   │   ├── index.tsx       # 首页
│   │   ├── bio/            # 身体追踪 + 数据分析
│   │   │   ├── index.tsx   # 体重与尺寸
│   │   │   ├── evolution.tsx # 图表
│   │   │   ├── goals.tsx   # 目标
│   │   │   ├── analytics.tsx # Strength Score、训练量、PRs
│   │   │   └── checkin.tsx # 月度打卡照片对比
│   │   ├── programs/       # 训练计划
│   │   │   ├── index.tsx   # 计划列表
│   │   │   ├── create.tsx  # 创建向导
│   │   │   ├── detail.tsx  # 详情 + 周网格
│   │   │   └── week-detail.tsx # 本周训练记录
│   │   ├── supplements/    # 补剂清单
│   │   │   └── index.tsx   # 每日清单 + 管理
│   │   ├── reports/        # 报告
│   │   │   └── weekly.tsx  # 周报 Markdown
│   │   ├── routines/       # 训练方案增删查改 + 编辑器 + 模板
│   │   ├── history/        # 日历 + 训练历史
│   │   ├── settings.tsx    # 设置、备份、CSV 导出、语言
│   │   └── about.tsx       # 关于应用
│   └── session/            # 训练流程（独立堆栈）
├── components/             # 22 个可复用 UI 组件
├── hooks/                  # 领域 hooks
├── services/               # 业务服务
├── src/
│   ├── db/                 # Drizzle ORM
│   ├── types/              # TypeScript 接口
│   ├── utils/              # 纯函数
│   ├── validators/         # Zod schemas
│   └── i18n/               # 翻译系统 (pt/en/es/zh)
├── __tests__/              # 29 套测试，385 项通过
├── constants/              # 颜色和字体
└── drizzle/                # SQL 迁移
```

---

## 📋 训练方案导入 (JSON)

```json
{
  "name": "Upper A - Push Focus",
  "description": "重点负重",
  "exercises": [
    {
      "name": "卧推",
      "target": "4x8",
      "rest": 180,
      "notes": "奥杆",
      "type": "strength"
    },
    {
      "name": "平板支撑",
      "target": "3x60s",
      "rest": 60,
      "type": "duration"
    }
  ]
}
```

---

## ⚙️ 可选配置

### Google Drive 备份

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建项目
2. 启用 **Google Drive API**
3. 创建 OAuth 2.0 凭据
4. 添加到 `.env`：
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

---

## 📄 文档

- [Português](../README.md)
- [English](README.en.md)
- [Español](README.es.md)

---

**许可证：** MIT · **作者：** Lucca Benedetti

