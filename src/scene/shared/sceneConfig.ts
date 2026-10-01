// ============================================================
// 场景共享契约（所有 scene 子模块只读此文件）
//
// 每个 scene 模块（ocean / sky / island）只依赖这里导出的常量与色板，
// 不互相 import。Scene.tsx 负责组装。
//
// 单位约定：米。世界原点 = 海岛中心水面交点，y 向上。
// ============================================================

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

/** 太阳方向（从场景指向太阳的单位向量）。灯光、天空、水面高光共用。 */
export const SUN_DIRECTION: readonly [number, number, number] = normalize3(-0.85, 0.22, -0.48)

/** 方向光安装距离（绕原点的公转半径） */
export const SUN_DISTANCE = 120

/** 主树所在的空地半径（岛心平台） */
export const CLEARING_RADIUS = 7

/** 岛缘半径：超过它的水底开始抬升为沙滩。水面泡沫Shader 用它算岸线。 */
export const SHORE_RADIUS = 24

/** 岛屿整体最大半径（含噪声起伏，超出即为海洋） */
export const ISLAND_MAX_RADIUS = 30

/** 海面网格尺寸与细分。波纹全部走法线，几何只做轻微涌浪位移。 */
export const OCEAN_SIZE = 1600
export const OCEAN_SEGMENTS = 256

/** 背景森林环（已完成的树）在岛台上的分布范围 */
export const FOREST_RING_INNER = 8.5
export const FOREST_RING_OUTER = 12.5

/** 相机 */
export const CAMERA_POSITION: readonly [number, number, number] = [29, 4.5, 37]
export const CAMERA_TARGET: readonly [number, number, number] = [0, 1.5, 0]
export const CAMERA_FOV = 45
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 4000
export const CAMERA_MIN_DISTANCE = 6
export const CAMERA_MAX_DISTANCE = 90
export const CAMERA_MAX_POLAR = Math.PI * 0.495

/** 雾：与天际线衔接，远端海天一线 */
export const FOG_COLOR = '#c3d8de'
export const FOG_NEAR = 120
export const FOG_FAR = 1100

/** 色板（整个场景只有这一组颜色，保证协调） */
export const PALETTE = {
  // 天空
  skyZenith: '#2b6ba8',
  skyHorizon: '#c3d8de',
  sunDisc: '#fff6d8',
  sunGlow: '#ffd9a0',
  // 水
  waterDeep: '#0a2c47',
  waterShallow: '#1e7f9c',
  waterScatter: '#3fa9b8',
  foam: '#f2fbfd',
  // 岛
  sand: '#e7d9a9',
  sandWet: '#c2ab7c',
  grass: '#79b64a',
  grassDark: '#4d8a3c',
  rock: '#7d7a72',
  rockDark: '#5c5a55',
  // 树（沿用原 app 的品牌绿）
  trunk: '#8a5a33',
  leafFresh: '#4f9c3a',
  leafRipe: '#67b043',
  leafWilt: '#8a7a5f',
  // 光
  sunLight: '#ffe8c0',
  skyLight: '#9fc4e8',
  groundBounce: '#5f8f4a',
} as const
