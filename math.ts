import type { Vec2, Vec3 } from './prism';

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, scalar: number): Vec2 => ({ x: a.x * scalar, y: a.y * scalar });
export const length = (v: Vec2) => Math.hypot(v.x, v.y);
export const distance = (a: Vec2, b: Vec2) => length(sub(a, b));
export const midpoint = (a: Vec2, b: Vec2): Vec2 => mul(add(a, b), 0.5);
export const normalize = (v: Vec2): Vec2 => {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len };
};
export const perpendicular = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });
