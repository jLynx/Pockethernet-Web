import { pairColorsForTia } from '@/app/format';
import type { TiaStandard } from '@/app/types';
import type { WiremapResult } from '@/pockethernetProtocol';

/** A self-contained PNG: readable without page CSS or external image requests. */
export function wiremapNotificationImage(
  result: WiremapResult,
  tia: TiaStandard,
): string | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#182333';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(`Wiremap · ${tia}${result.id > 0 ? ` · ID ${result.id}` : ''}`, 20, 30);
  ctx.font = '18px Arial';
  ctx.fillText(result.summary, 20, 58, 600);
  const pins = [1, 2, 3, 6, 4, 5, 7, 8, 9];
  const colors = pairColorsForTia(tia);
  const yFor = (pin: number): number => 90 + pins.indexOf(pin) * 33;
  const line = (x1: number, y1: number, x2: number, y2: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  pins.forEach((pin, index) => {
    const y = yFor(pin);
    const destination = result.connections[pin];
    const color = pin === 9 ? '#475569' : colors[Math.floor(index / 2)];
    ctx.fillStyle = '#182333';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(pin === 9 ? 'S' : String(pin), 20, y + 7);
    ctx.fillText(pin === 9 ? 'S' : String(pin), 605, y + 7);
    ctx.lineWidth = 7;
    ctx.setLineDash([1, 3, 5, 7].includes(pin) ? [12, 7] : []);
    line(50, y, 155, y, color);
    line(485, y, 585, y, color);
    if (destination > 0 && destination < 10) line(155, y, 485, yFor(destination), color);
    else {
      ctx.fillStyle = '#b91c1c';
      ctx.font = '16px Arial';
      ctx.fillText(destination === 255 ? '?' : 'Open', 290, y + 6);
    }
  });
  ctx.setLineDash([]);
  ctx.lineWidth = 4;
  const seen = new Set<string>();
  pins.forEach((pin) => {
    const other = result.shorts[pin];
    if (!(other > 0 && other < 10)) return;
    const key = [pin, other].sort((a, b) => a - b).join('-');
    if (seen.has(key)) return;
    seen.add(key);
    const x = 170 + seen.size * 16;
    line(x, yFor(pin), x, yFor(other), '#dc2626');
    ctx.fillStyle = '#dc2626';
    [pin, other].forEach((endpoint) => {
      ctx.beginPath();
      ctx.arc(x, yFor(endpoint), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  return canvas.toDataURL('image/png');
}
