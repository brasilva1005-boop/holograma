export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };

export type TrackedHand = {
  thumb: Vec3;
  index: Vec3;
  centerX: number;
};

export type PrismMode = 'none' | 'book' | 'pyramid' | 'inverted-pyramid' | 'diamond';

export type PrismGeometry = {
  mode: PrismMode;
  facets: Vec2[][];
  border: Vec2[];
  crease?: [Vec2, Vec2];
  opticalCenter: Vec2;
  fold: number;
  confidence: number;
};
