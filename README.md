# Focus Forest 3D（专注森林 3D）

用 React Three Fiber 复刻的 3D 版专注森林：选好时长种下一棵树，倒计时期间场景中的树随进度生长，完成后留在背景森林里，中途放弃则会枯萎。

## 功能特性

- **倒计时专注**：15 / 25 / 45 / 60 分钟四档预设时长，默认 25 分钟。
- **树木随进度生长**：会话进行中，主树随时间进度生长。
- **中途放弃树木枯萎**：倒计时结束前放弃，树木进入枯萎状态。
- **完成后存入背景森林**：倒计时归零即完成，自动种下一棵树存入背景森林（最多保留最近 60 棵）。
- **轨道镜头**：`idle` 待机时相机自动环绕旋转。
- **localStorage 本地存档**：累计树木数、累计专注时长与背景森林经 zustand persist 持久化，刷新不丢失。
- **2D 兼容模式**：检测到浏览器不支持 WebGL 时自动降级为 2D 场景，功能完整不白屏。
- **单文件构建**：`dist/index.html` 自包含全部资源，双击即可离线运行。

## 技术栈

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| react / react-dom | ^19.3.0 | UI 运行时 |
| typescript | ^5.6.3（strict） | 类型系统 |
| vite | ^5.4.21 | 开发服务器与生产构建 |
| @react-three/fiber | ^9.8.1 | React 渲染 three.js 3D 场景（v9 起支持 WebGPU 渲染器） |
| @react-three/drei | ^10.7.9 | 轨道相机等 3D 辅助组件 |
| three | ^0.186.1 | 底层渲染；3D 场景统一走 `three/webgpu` 的 WebGPURenderer |
| zustand | ^5.0.15 | 全局状态管理（含 persist 中间件） |

版本号以 `package.json` 为准。

### 渲染架构：一个渲染器覆盖所有设备

3D 场景只用 `three/webgpu` 的 `WebGPURenderer`：**WebGPU 可用时走原生 WebGPU 后端，不可用时自动回退 WebGL2 后端**（同一份 TSL 节点材质、同一份场景代码，回退时控制台只有一条提示）。因此不需要为两条 3D 路径维护两套素材，也覆盖了 Android WebView 等 WebGPU 尚未普及的环境；只有连 WebGL2 都没有的设备（部分应用内浏览器、远程桌面）才降级到 2D 兼容场景。

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器，默认 http://localhost:5173
npm run build      # 先 tsc --noEmit 类型检查，再构建到 dist/
npm run typecheck  # 仅做全项目 TypeScript 类型检查
```

> 开发服务器端口在 `vite.config.ts` 中固定为 5173，并开启了 `host: true`，局域网内可通过本机 IP 访问。

### 三种打开方式

| 方式 | 命令 / 操作 | 适用场景 |
| --- | --- | --- |
| 开发服务器 | `npm run dev` 后访问 http://localhost:5173 | 日常开发调试 |
| 静态预览 | `npm run build && npm run preview` | 验证生产构建 |
| 双击打开 | `npm run build` 后**直接双击 `dist/index.html`** | 不想起服务、发给别人 | 

构建产物经 `vite-plugin-singlefile` 内联为单个 `dist/index.html`（JS/CSS 全部内嵌，约 1.9 MB，其中大半是 WebGPURenderer 与节点着色系统），file:// 协议双击即可运行，无需任何服务器。

### 兼容性说明

场景会先探测 GPU 能力（WebGPU / WebGL2）：有任一后端即渲染完整 3D 场景（WebGPURenderer 自动选择后端，WebGPU 优先）；都没有的环境（部分应用内浏览器、远程桌面等）自动降级为 **2D 兼容场景**（同款生长/枯萎逻辑，HUD 功能完全一致，底部有提示条）。若 3D 场景运行时崩溃，`SceneBoundary` 也会兜底切换到 2D 场景，不会出现白屏。

## 目录结构

```
focus-forest-3d/
├── index.html               # Vite 入口 HTML
├── package.json / tsconfig.json / vite.config.ts
├── docs/
│   └── ARCHITECTURE.md       # 架构与组件契约（接手指南）
└── src/
    ├── main.tsx              # React 入口，挂载 #root
    ├── App.tsx               # 布局外壳：Scene/hud-layer(HUD) + GPU 能力探测与降级
    ├── index.css             # 全局 reset 与画布兜底样式
    ├── store/
    │   └── focusStore.ts     # zustand 单一数据源（含 persist 持久化）
    ├── hooks/
    │   ├── useSessionTicker.ts# 会话计时器（驱动 tick）
    │   └── useRendererSupport.ts# GPU 能力探测（webgpu / webgl2 / none 三级）
    └── scene/                # 3D 场景（海岛 + 海洋）
        ├── Scene.tsx         # Canvas 组合根：WebGPURenderer 工厂、相机、雾、组装
        ├── CameraRig.tsx     # OrbitControls + 缩放总线 + idle 自动旋转
        ├── SceneBoundary.tsx # 3D 崩溃时的 ErrorBoundary（降级 2D）
        ├── FallbackScene.tsx # 2D 兼容场景（无 GPU 后端时启用）
        ├── fallback.css      # 2D 场景样式
        ├── Tree.tsx          # 主角树：生长/枯萎（程序化几何，站岛心平台）
        ├── ForestPlot.tsx    # 背景森林环（已完成的树，贴地形）
        ├── ocean/            # 海面：Ocean.tsx + waterMaterial.ts（TSL 程序化水体）
        ├── sky/              # SkyDome.tsx（TSL 天空 + PMREM 环境）+ SunLight.tsx
        ├── island/           # Island.tsx（地形高度场 + 顶点色）+ Rocks.tsx（礁石）
        ├── props/            # ShorePlants.tsx（芦苇）+ Atmosphere.tsx（海雾）
        └── shared/           # 共享契约（只读）：sceneConfig.ts + terrain.ts
    └── ui/                   # HUD 界面（组件无 props，只读 store）
        ├── HUD.tsx           # hud-layer 内的组合容器
        ├── TimerRing.tsx     # 倒计时圆环
        ├── DurationPicker.tsx# 15/25/45/60 时长选择
        ├── Controls.tsx      # 开始/暂停/放弃/重置
        ├── StatsPanel.tsx    # 树木数与累计时长
        └── hud.css           # HUD 全部样式（由 ui 负责人维护）
```

> 说明：`src/scene` 与 `src/ui` 下的组件按契约并行开发，以实际代码与 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 的契约为准。

## 模块边界与并行开发

- `src/store/focusStore.ts` 是**唯一数据源**：所有状态字段与写动作都从这里进出。
- `src/scene` 与 `src/ui` 下的组件**一律无 props、只读 store**（通过 `useFocusStore` selector 订阅），因此两个目录可以并行开发、互不依赖。
- 组件不跨目录 import；组合只发生在目录内部（`Scene` 组装 scene 子组件，`HUD` 组装 ui 子组件）。
- 样式归属：全局基础样式在 `src/index.css`，HUD 样式在 `src/ui/hud.css`。
- 详细的组件契约、数据流与并发约定见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 会话状态机

```
                       pause()      resume()
   idle ──start(min?)──▶ running ◀────────────▶ paused
                         │  ▲
              giveUp()   │  │ tick(dtSec) 累加 elapsedSec
                         ▼  │
                       dead  │ elapsedSec >= durationMin * 60
                            ▼
                       completed（treesGrown + 1，forest 追加一棵树）
```

- `dead` / `completed` 都可再次 `start()` 开启新会话；`reset()` 回到 `idle`。
- `setDuration(min)` 只在 `idle` 时生效（会话进行中忽略）。
- `tick()` 只在 `running` 时推进时间。

## 后续扩展方向

- 更多树种与随机树形；
- 白噪音 / 环境音效；
- 统计图表（每日专注时长、完成率）；
- 移动端适配（手势、安全区）；
- 多云存档同步（账号体系 + 后端存储）。
