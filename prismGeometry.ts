import { add, clamp, distance, midpoint, mul, normalize, perpendicular, sub } from './math';
import type { PrismGeometry, TrackedHand, Vec2 } from './prism';

const PINCH_THRESHOLD = 0.072;
const MIN_SINGLE_HAND_GAP = 0.055;

const project = (point: { x: number; y: number }, width: number, height: number): Vec2 => ({
  x: point.x * width,
  y: point.y * height,
});

export function buildPrismGeometry(
  hands: TrackedHand[],
  width: number,
  height: number,
): PrismGeometry {
  if (hands.length === 0 || width <= 0 || height <= 0) {
    return {
      mode: 'none',
      facets: [],
      border: [],
      opticalCenter: { x: width / 2, y: height / 2 },
      fold: 0,
      confidence: 0,
    };
  }

  if (hands.length === 1) {
    const hand = hands[0];
    const thumbN = { x: hand.thumb.x, y: hand.thumb.y };
    const indexN = { x: hand.index.x, y: hand.index.y };
    const gap = distance(thumbN, indexN);

    if (gap < MIN_SINGLE_HAND_GAP) {
      return {
        mode: 'none',
        facets: [],
        border: [],
        opticalCenter: project(midpoint(thumbN, indexN), width, height),
        fold: 0,
        confidence: clamp(gap / MIN_SINGLE_HAND_GAP),
      };
    }

    const thumb = project(thumbN, width, height);
    const index = project(indexN, width, height);
    const center = midpoint(thumb, index);
    const axis = sub(index, thumb);
    const side = mul(normalize(perpendicular(axis)), Math.hypot(axis.x, axis.y) * 0.42);
    const right = add(center, side);
    const left = sub(center, side);
    const border = [index, right, thumb, left];

    return {
      mode: 'diamond',
      facets: [border],
      border,
      crease: [left, right],
      opticalCenter: center,
      fold: clamp((indexN.y - thumbN.y) * 1.6, -1, 1),
      confidence: clamp((gap - MIN_SINGLE_HAND_GAP) / 0.18),
    };
  }

  const ordered = [...hands].sort((a, b) => a.centerX - b.centerX);
  const [leftHand, rightHand] = ordered;

  const liN = { x: leftHand.index.x, y: leftHand.index.y };
  const riN = { x: rightHand.index.x, y: rightHand.index.y };
  const ltN = { x: leftHand.thumb.x, y: leftHand.thumb.y };
  const rtN = { x: rightHand.thumb.x, y: rightHand.thumb.y };

  const li = project(liN, width, height);
  const ri = project(riN, width, height);
  const lt = project(ltN, width, height);
  const rt = project(rtN, width, height);

  const topTouch = distance(liN, riN) < PINCH_THRESHOLD;
  const bottomTouch = distance(ltN, rtN) < PINCH_THRESHOLD;

  const zLeft = (leftHand.index.z + leftHand.thumb.z) * 0.5;
  const zRight = (rightHand.index.z + rightHand.thumb.z) * 0.5;
  const tiltLeft = leftHand.index.y - leftHand.thumb.y;
  const tiltRight = rightHand.index.y - rightHand.thumb.y;
  const fold = clamp((zRight - zLeft) * 5.2 + (tiltRight - tiltLeft) * 0.9, -1, 1);

  if (topTouch && !bottomTouch) {
    const apex = midpoint(li, ri);
    const baseCenter = midpoint(lt, rt);
    return {
      mode: 'pyramid',
      facets: [
        [apex, baseCenter, lt],
        [apex, rt, baseCenter],
      ],
      border: [apex, rt, lt],
      crease: [apex, baseCenter],
      opticalCenter: midpoint(apex, baseCenter),
      fold,
      confidence: 1,
    };
  }

  if (bottomTouch && !topTouch) {
    const apex = midpoint(lt, rt);
    const topCenter = midpoint(li, ri);
    return {
      mode: 'inverted-pyramid',
      facets: [
        [li, topCenter, apex],
        [topCenter, ri, apex],
      ],
      border: [li, ri, apex],
      crease: [topCenter, apex],
      opticalCenter: midpoint(topCenter, apex),
      fold,
      confidence: 1,
    };
  }

  const topMid = midpoint(li, ri);
  const bottomMid = midpoint(lt, rt);
  const spine = sub(bottomMid, topMid);
  const spineNormal = normalize(perpendicular(spine));
  const widthPx = Math.max(distance(li, ri), distance(lt, rt));
  const projectedDepthOffset = mul(spineNormal, fold * widthPx * 0.14);
  const creaseTop = add(topMid, projectedDepthOffset);
  const creaseBottom = add(bottomMid, projectedDepthOffset);
  const center = midpoint(creaseTop, creaseBottom);

  return {
    mode: 'book',
    facets: [
      [li, creaseTop, creaseBottom, lt],
      [creaseTop, ri, rt, creaseBottom],
    ],
    border: [li, ri, rt, lt],
    crease: [creaseTop, creaseBottom],
    opticalCenter: center,
    fold,
    confidence: 1,
  };
}
