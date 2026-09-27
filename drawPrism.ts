import type { PrismGeometry, Vec2 } from './prism';
import { clamp } from './math';

function polygonPath(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function strokeOpenLine(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  width: number,
  color: string,
  blur: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.stroke();
  ctx.restore();
}

export function drawPrism(
  ctx: CanvasRenderingContext2D,
  shaderCanvas: HTMLCanvasElement,
  geometry: PrismGeometry,
): void {
  if (geometry.mode === 'none' || geometry.facets.length === 0) return;

  geometry.facets.forEach((facet, index) => {
    ctx.save();
    polygonPath(ctx, facet);
    ctx.clip();
    ctx.globalAlpha = 0.93;
    ctx.drawImage(shaderCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);

    const highlight = ctx.createLinearGradient(
      facet[0].x,
      facet[0].y,
      facet[Math.floor(facet.length / 2)].x,
      facet[Math.floor(facet.length / 2)].y,
    );
    const foldBias = clamp(0.28 + Math.abs(geometry.fold) * 0.28, 0.22, 0.62);
    highlight.addColorStop(0, index % 2 === 0 ? `rgba(0,240,255,${foldBias})` : `rgba(255,0,127,${foldBias})`);
    highlight.addColorStop(0.5, 'rgba(255,255,255,0.035)');
    highlight.addColorStop(1, index % 2 === 0 ? 'rgba(255,230,0,0.13)' : 'rgba(57,255,20,0.13)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  });

  // Glow externo colorido.
  ctx.save();
  polygonPath(ctx, geometry.border);
  const borderGradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height);
  borderGradient.addColorStop(0, '#00F0FF');
  borderGradient.addColorStop(0.34, '#39FF14');
  borderGradient.addColorStop(0.68, '#FFE600');
  borderGradient.addColorStop(1, '#FF007F');
  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.52;
  ctx.stroke();
  ctx.restore();

  // Núcleo branco fino, aproximadamente 1.8 px.
  ctx.save();
  polygonPath(ctx, geometry.border);
  ctx.strokeStyle = 'rgba(255,255,255,0.98)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.restore();

  if (geometry.crease) {
    const [a, b] = geometry.crease;
    strokeOpenLine(ctx, a, b, 10, 'rgba(0,240,255,0.28)', 24);
    strokeOpenLine(ctx, a, b, 4.2, 'rgba(255,0,127,0.65)', 12);
    strokeOpenLine(ctx, a, b, 1.65, 'rgba(255,255,255,1)', 5);
  }
}
