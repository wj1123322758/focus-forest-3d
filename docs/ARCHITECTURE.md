# Focus Forest 3D — 架构说明

面向后续接手的开发者。本文档描述唯一数据源（store）、数据流、组件契约、会话状态机与并行开发约定。

> 注意：`src/scene` 与 `src/ui` 已按以下契约实现完毕；改动前请以本文档和 `src/store/focusStore.ts` 的实际代码为准。

## 1. 数据流

单一数据源：`src/store/focusStore.ts`（zustand + persist 中间件）。

1. **时间推进**：`src/hooks/useSessionTicker.ts` 在 `status === 'running'` 时挂一个约 1s 的 `setInterval`，用 `performance.now()` 差值算出真实墙钟时间 `dtSec`，调用 `tick(dtSec)`；单步最大 5 秒（`MAX_STEP_SEC`），防止切后台/切 tab 后时间跳变。
2. **store 更新**：`tick` 累加 `elapsedSec`，经 `derive()` 派生 `progress`（0~1）与 `remainingSec`（`durationMin * 60 - elapsedSec` 向上取整）；`elapsedSec >= durationMin * 60` 时置 `status = 'completed'`、`treesGrown + 1`、`totalElapsedSec += total`，并往 `forest` 追加一棵 `ForestTree`（`{ id, plantedAt, durationMin }`，数组只保留最近 60 棵）。
3. **场景订阅**：`src/scene/Scene.tsx`、`Tree.tsx`、`ForestPlot.tsx` 订阅 `status` / `progress` / `durationMin` / `forest` 驱动树的生长、枯萎与背景森林。
4. **界面订阅**：`src/ui/*` 订阅 `status` / `remainingSec` / `progress` / `durationMin` / `treesGrown` / `totalElapsedSec` / `forest` 渲染 UI，并调用 `start` / `pause` / `resume` / `giveUp` / `reset` / `setDuration` 写回 store。
5. **持久化**：zustand `persist` 将部分状态写入 localStorage，key 为 `focus-forest-3d`；`partialize` 仅持久化 `forest` / `treesGrown` / `totalElapsedSec` / `durationMin`，运行中的会话状态（`status` / `elapsedSec` / `progress` / `remainingSec`）不持久化。
6. **渲染通道选择**：`src/App.tsx` 先用 `src/hooks/useRendererSupport.ts` 探测 GPU 能力（`webgpu` / `webgl2` / `none` 三级）；任一可用即经 `src/scene/SceneBoundary.tsx`（ErrorBoundary）挂载 3D `Scene`，`none`（无 GPU 的嵌入式/应用内浏览器、远程桌面）或运行中崩溃则降级到 `src/scene/FallbackScene.tsx`（2D DOM 场景，订阅同一 store，生长/枯萎状态机一致）。两条通道共用同一 HUD 与会话逻辑。

   > 3D 通道只认一个渲染器：`three/webgpu` 的 `WebGPURenderer`。它在 WebGPU 缺失时**自动切到 WebGL2 后端**（同一份 TSL 节点材质、同一份场景代码），所以探测只需回答"有没有 GPU 后端"，不需要为两条 3D 路径各写一套。`<Canvas gl={...}>` 用异步工厂创建并 `await renderer.init()`，R3F v9 会等工厂 resolve 后才挂载子组件。

```
 useSessionTicker ── tick(dtSec) ──▶ useFocusStore ◀── start()/pause()/… ── src/ui/*
                                          │
                    status/progress/forest │
                     ┌────────────────────┼─────────────────────┐
                     ▼                    ▼                     ▼
              src/scene/Scene      src/scene/FallbackScene   src/ui/*（HUD）
        （WebGPURenderer：WebGPU  （无 GPU 后端/崩溃降级）      （两条通道共用）
         优先，自动回退 WebGL2）

 useFocusStore ─ persist(localStorage, key: "focus-forest-3d") ─▶ 刷新后恢复
                                                  （仅 forest/treesGrown/
                                                   totalElapsedSec/durationMin）
```

## 2. 组件契约

总规则：所有组件**无 props**，状态一律经 `useFocusStore` 读写； Scene/HUD 例外地作为各自目录的**组合根**在同目录内组装子组件，叶子组件之间**互不 import、互不传 props**；严禁跨目录 import。

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `src/scene/Scene.tsx` | R3F `<Canvas>` 组合根：WebGPURenderer 异步工厂（`await init()`，WebGPU 优先/WebGL2 自动回退）、相机与雾、按层组装全部场景子组件 | 同目录子组件 + `shared/sceneConfig` |
| `src/scene/CameraRig.tsx` | 相机：`OrbitControls` 轨道/缩放（idle 自动旋转）+ `cameraBus` 缩放意图（与滚轮/捏合同一套距离钳制） | store（`status`）+ cameraBus + `shared/sceneConfig` |
| `src/scene/SceneBoundary.tsx` | 3D 场景的 ErrorBoundary：运行中崩溃时降级渲染 `FallbackScene` | 同目录子组件 |
| `src/scene/FallbackScene.tsx` | 2D 兼容场景（DOM + CSS）：无 GPU 后端环境使用，生长/枯萎规则与 Tree.tsx 一致，样式在 `fallback.css` | store（`progress` / `status`） |
| `src/scene/Tree.tsx` | 主角树（程序化树干 + 三团 foliage）：按 `progress` 生长，`dead` 枯萎，`completed` 泛熟；站在岛心平台 | store（`progress` / `status`）+ `shared/terrain` |
| `src/scene/ForestPlot.tsx` | 背景森林环：按 `forest` 数组在岛坡上渲染已完成的树（确定性排布） | store（`forest`）+ `shared/terrain` |
| `src/scene/ocean/Ocean.tsx` + `waterMaterial.ts` | 海面：单张平面网格 + TSL 程序化水体（波纹法线/深浅渐变/岸线泡沫/碎光），无贴图、无逐帧 CPU 开销 | `shared/sceneConfig` |
| `src/scene/sky/SkyDome.tsx` | 天空穹顶（TSL 渐变 + 日盘 + 光晕）＋ 用它生成 PMREM 环境贴图（`scene.environment`，水面反射来源）；`fog:false`、`lights:false` | `shared/sceneConfig` |
| `src/scene/sky/SunLight.tsx` | 方向光（投影）+ 半球环境光 | `shared/sceneConfig` |
| `src/scene/island/Island.tsx` | 海岛地形：径向高度场位移（`shared/terrain.islandHeight`）+ 顶点色（湿沙/沙/草/岩） | `shared/terrain` + `shared/sceneConfig` |
| `src/scene/island/Rocks.tsx` | 沿岸礁石（确定性摆放，贴地形） | `shared/terrain` + `shared/sceneConfig` |
| `src/scene/props/ShorePlants.tsx` | 岸线芦苇（InstancedMesh，确定性摆放） | `shared/terrain` + `shared/sceneConfig` |
| `src/scene/props/Atmosphere.tsx` | 岸线海雾（实例化公告板，逐帧面朝相机） | `shared/terrain` + `shared/sceneConfig` |
| `src/scene/shared/sceneConfig.ts` | 场景共享契约：太阳方向、相机、雾、海/岛尺寸、统一色板（**只读**，新模块从这里取常数） | 无 |
| `src/scene/shared/terrain.ts` | 地形高度场 `islandHeight/islandSlope` 与确定性哈希（**只读**；Island/Rocks/ShorePlants/Tree/ForestPlot 共用，保证泡沫半径与资产摆放对齐） | 无 |
| `src/ui/HUD.tsx` | `.hud-layer` 内的组合容器：排布 TimerRing/DurationPicker/Controls/StatsPanel | store + 同目录子组件 |
| `src/ui/TimerRing.tsx` | 剩余时间圆环（mm:ss + `progress` 环） | store（`progress` / `remainingSec`） |
| `src/ui/Controls.tsx` | 开始/暂停/继续/放弃/重置按钮，按 `status` 切换可用态 | store（`status` 及全部动作） |
| `src/ui/DurationPicker.tsx` | 15/25/45/60 分钟档位（`DURATION_PRESETS`），会话进行中禁用 | store（`durationMin`，`setDuration`） |
| `src/ui/StatsPanel.tsx` | 统计展示：`treesGrown`（累计树木）、`totalElapsedSec`（累计专注时长） | store（`treesGrown` / `totalElapsedSec`） |

## 3. 会话状态机

```
                  start(min?)              pause()      resume()
     idle ─────────────────▶ running ◀──────────────────▶ paused
                              │  ▲
                  giveUp()    │  │ tick(dtSec)（仅 running 累加）
                              ▼  │
                            dead  │ elapsedSec >= durationMin * 60
                                 ▼
                            completed（种一棵树，存入 forest）

   任意状态 ── reset() ──▶ idle
```

| 状态 | 含义 | 可触发动作 |
| --- | --- | --- |
| `idle` | 待机（镜头自动旋转） | `start(min?)`、`setDuration(min)` |
| `running` | 倒计时进行中 | `pause()`、`giveUp()`、`tick(dtSec)` |
| `paused` | 已暂停 | `resume()`、`giveUp()` |
| `completed` | 完成，种一棵树 | `start(min?)`（新会话）、`reset()` |
| `dead` | 中途放弃，树木枯萎 | `start(min?)`（新会话）、`reset()` |

守卫条件（以 `focusStore.ts` 为准）：

- `start(durationMin?)`：重置 `elapsedSec` 为 0；不传参则沿用当前 `durationMin`。
- `pause()` 仅在 `running` 有效；`resume()` 仅在 `paused` 有效。
- `giveUp()` 仅在 `running` / `paused` 有效，置 `dead`。
- `tick(dtSec)` 仅在 `running` 且 `dtSec > 0` 时推进。
- `setDuration(min)` 仅在 `idle` 且 `min > 0` 时生效。
- `forest` 上限 60 棵（`FOREST_CAP`），超出只保留最近部分。

## 4. 并行开发约定

1. 新增组件一律**无 props**，全部状态经 `useFocusStore` 读写；禁止 prop drilling。
2. 样式归属：全局基础样式（reset、canvas、`.app`、`.hud-layer`）写 `src/index.css`；HUD 全部样式写 `src/ui/hud.css`。`.hud-layer` 全局 `pointer-events: none`，可交互控件需在 `hud.css` 内自行 `pointer-events: auto`。
3. 不要跨目录 import：`src/scene` 不 import `src/ui`（反之亦然），公共依赖只允许是 `store` 与 `hooks`。
4. `Scene.tsx` / `HUD.tsx` 是各自目录的组合根；叶子组件互不 import、互不传 props。
5. store 是唯一数据源；如需新增字段/动作，改 `src/store/focusStore.ts` 并同步更新本文档，不要在组件里另起状态源。
6. 场景子模块（ocean / sky / island / props）**只依赖** `src/scene/shared/`（sceneConfig + terrain）与自身目录，不互相 import；新增模块先在 `shared/sceneConfig.ts` 加常数与色板条目，再写组件。
7. 写 TSL 材质前先读第 5 节（颜色常量、`mix().toVar()`、smoothstep 边缘顺序等静默失败陷阱）。
8. 相机统一由 `CameraRig` 持有（OrbitControls）；HUD 的缩放意图走 `src/cameraBus.ts`，不要在组件里直接摸相机。

## 5. TSL / WebGPU 渲染约定（改材质前必读）

新场景全部跑在 `three/webgpu` 的 `WebGPURenderer` 上（WebGPU 缺失时自动 WebGL2 后端）。以下约定来自实测踩坑，违反会出现**不报错但画面全错**的静默失败：

1. **导入**：渲染器/节点材质从 `'three/webgpu'`；TSL 函数从 `'three/tsl'`。两者共享 `three.core.js`（同一实例），但 classic 材质（`MeshStandardMaterial` 等）与 GLSL `ShaderMaterial` 在 WebGPURenderer 下不可用。
2. **颜色常量**：调色板 hex 在 JS 侧 `new Color(hex)`（ColorManagement 自动转线性）后 `vec3(c.r, c.g, c.b)`。**不要**用 TSL `color()`/`uniform(new Color(...))` 直接参与 `mix()`：实测会静默丢掉混合。
3. **`mix()` 链要用 `.toVar()` 断开**：连续的 `mix(mix(...), x, y)` 会让 TSL 的类型推断退化，混合因子被忽略（表现为颜色停在第一个参数）。
4. **`smoothstep(a, b, x)` 的 a 必须小于 b**；要做"内部为 1"的遮罩时直接 `smoothstep(softEdge, crispEdge, x)`，**不要**套 `oneMinus`——把边缘写反会让遮罩在整个画面为 1（整屏被涂成该颜色的经典事故）。
5. **`normalNode` 在视图空间消费**：世界法线要先 `transformNormalByViewMatrix(cameraViewMatrix)`。
6. **天空/环境**：`MeshBasicNodeMaterial` 做天空要 `fog: false`（否则整片穹顶被线性雾抹成雾色）且 `lights = false`（否则环境贴图会被二次乘进天空）。环境贴图用 `PMREMGenerator(renderer).fromScene(只有穹顶的临时场景)`，赋给 `scene.environment`。
7. **性能**：水/雾等全程序化、无贴图；单文件构建产物约 1.9 MB（WebGPURenderer + 节点着色系统体积）。

## 6. 已知取舍

- 只有一版程序化树（枝干与树冠由基础几何拼装）与程序化海岛、海面，无外部模型/贴图资源。
- 水波为 normal-only 方案（平面几何不动，法线走程序噪声 + 有限差分），不做顶点位移，换来单次绘制、无 CPU 逐帧开销。
- 阴影与粒子从简，优先保证帧率。
- 计时用 `setInterval`（1s）+ `performance.now()` 墙上时间校准，切后台最多按 5 秒步进追赶。
- 会话运行态不持久化：刷新后回到 `idle`，只保留 `forest` / `treesGrown` / `totalElapsedSec` / `durationMin`。
- `forest` 只保留最近 60 棵，避免 localStorage 无限膨胀。
- 无 GPU 后端（部分应用内浏览器、远程桌面）或 3D 场景崩溃时降级 2D 场景：功能可用，但失去 3D 视觉。
- 构建经 `vite-plugin-singlefile` 打成单个 `dist/index.html`（file:// 双击可开），代价是单文件约 1.9 MB、无 HTTP 缓存粒度。
