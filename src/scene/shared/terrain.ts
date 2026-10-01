// ============================================================
// 海岛地形高度场（共享契约）
//
// Island.tsx 用它生成几何，Rocks / ShorePlants 用它摆放资产，
// Ocean 的岸线泡沫半径与它对齐（地形在 r≈SHORE_RADIUS 处穿过 y=0）。
// 纯函数、确定性（噪声走 FNV-1a 哈希，不用 Math.random）。
// ============================================================

import { CLEARING_RADIUS, SHORE_RADIUS } from './sceneConfig'

/** 地形网格半径：超出即沉入水下，被水面遮住 */
export const ISLAND_TERRAIN_RADIUS = 40

/** 岛心平台高度（主树扎根处） */
const PLATEAU_HEIGHT = 0.35
/** 山坡顶高度 */
const HILL_HEIGHT = 2.7
/** 山坡顶所在半径 */
const HILL_RADIUS = 14

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// FNV-1a 格点哈希折叠到 0..1（内部用地格噪声，勿与对外 hash01 混淆）
const lattice01 = (x: number, y: number, salt: number): number => {
  let h = 2166136261 ^ salt
  const ix = Math.round(x * 1024)
  const iy = Math.round(y * 1024)
  h = Math.imul(h ^ (ix & 0xff), 16777619)
  h = Math.imul(h ^ ((ix >> 8) & 0xff), 16777619)
  h = Math.imul(h ^ (iy & 0xff), 16777619)
  h = Math.imul(h ^ ((iy >> 8) & 0xff), 16777619)
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  return ((h >>> 0) % 100000) / 100000
}

// 平滑值噪声（双线性 + smoothstep 插值）
const valueNoise = (x: number, y: number, salt: number): number => {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = lattice01(xi, yi, salt)
  const b = lattice01(xi + 1, yi, salt)
  const c = lattice01(xi, yi + 1, salt)
  const d = lattice01(xi + 1, yi + 1, salt)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

const fbm = (x: number, y: number, octaves: number, salt: number): number => {
  let sum = 0
  let amplitude = 0.5
  let total = 0
  let fx = x
  let fy = y
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(fx, fy, salt + i * 31) * amplitude
    total += amplitude
    amplitude *= 0.5
    fx *= 2.03
    fy *= 1.97
  }
  return sum / total
}

/** -1..1 的起伏 */
const relief = (x: number, z: number): number => fbm(x * 0.12, z * 0.12, 3, 7) * 2 - 1

/**
 * 地形高度。
 * 平台(0.35) → 山坡(2.7) → 沙滩(0.05) → 水下(-1.5)。
 * 噪声让岸线有机化，平台附近几乎平坦（主树站得稳）。
 */
export function islandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)

  let base: number
  if (r <= CLEARING_RADIUS) {
    base = PLATEAU_HEIGHT
  } else if (r <= HILL_RADIUS) {
    base = PLATEAU_HEIGHT + (HILL_HEIGHT - PLATEAU_HEIGHT) * smoothstep(CLEARING_RADIUS, HILL_RADIUS, r)
  } else if (r <= SHORE_RADIUS) {
    base = HILL_HEIGHT + (0.05 - HILL_HEIGHT) * smoothstep(HILL_RADIUS, SHORE_RADIUS, r)
  } else {
    base = 0.05 + (-1.5 - 0.05) * smoothstep(SHORE_RADIUS, ISLAND_TERRAIN_RADIUS, r)
  }

  const noiseAmount =
    r <= CLEARING_RADIUS
      ? 0.06
      : r <= HILL_RADIUS
        ? 0.5
        : r <= SHORE_RADIUS
          ? 0.35
          : 0.25

  return base + relief(x, z) * noiseAmount
}

/** 采样点的坡度（0=平坦，1=陡峭），供着色/摆放使用 */
export function islandSlope(x: number, z: number): number {
  const d = 0.5
  const hx = islandHeight(x + d, z) - islandHeight(x - d, z)
  const hz = islandHeight(x, z + d) - islandHeight(x, z - d)
  return Math.min(1, Math.hypot(hx, hz) / (2 * d))
}

/** 确定性 0..1 随机（摆放资产用），用法同 ForestPlot 的哈希 */
export function hash01(id: number, salt: number): number {
  let h = 2166136261 ^ (salt * 2654435761)
  h = Math.imul(h ^ (id & 0xffff), 16777619)
  h = Math.imul(h ^ ((id >> 16) & 0xffff), 16777619)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h >>> 0) % 100000) / 100000
}
