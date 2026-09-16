import type { ReactElement } from 'react';
import type { WiremapResult } from '@/pockethernetProtocol';
import type { TiaStandard } from '@/app/types';

export function WiremapDiagram({
  result,
  tia = '568B',
}: {
  result: WiremapResult | null;
  tia?: TiaStandard;
}): ReactElement {
  if (!result) return <div className="wiremap-awaiting">Run a measurement to see the wiremap</div>;
  const pins = [1, 2, 3, 6, 4, 5, 7, 8, 9];
  const colors: Record<number, string> =
    tia === '568A'
      ? {
          1: '#17a12a',
          2: '#17a12a',
          3: '#ff941e',
          6: '#ff941e',
          4: '#1049cf',
          5: '#1049cf',
          7: '#a56a2c',
          8: '#a56a2c',
          9: '#000000',
        }
      : {
          1: '#ff941e',
          2: '#ff941e',
          3: '#17a12a',
          6: '#17a12a',
          4: '#1049cf',
          5: '#1049cf',
          7: '#a56a2c',
          8: '#a56a2c',
          9: '#000000',
        };
  const striped = new Set([1, 3, 5, 7]);
  const yFor = (wire: number): number => 38 + pins.indexOf(wire) * 54;
  const line = (
    wire: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    key: string,
  ): ReactElement => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={colors[wire]}
      strokeWidth="15"
      strokeDasharray={striped.has(wire) ? '34 28' : undefined}
    />
  );
  const shorts: { low: number; high: number; x: number }[] = [];
  const seenShorts = new Set<string>();
  for (let wire = 1; wire <= 9; wire += 1) {
    const other = result.shorts[wire];
    if (!(other > 0 && other < 10)) continue;
    const low = Math.min(wire, other);
    const high = Math.max(wire, other);
    const key = `${low}-${high}`;
    if (seenShorts.has(key)) continue;
    seenShorts.add(key);
    shorts.push({
      low,
      high,
      x: pins.indexOf(low) < 4 ? 258 + pins.indexOf(low) * 20 : 620 + (pins.indexOf(low) - 4) * 20,
    });
  }
  return (
    <div className="wiremap-diagram">
      <svg viewBox="0 0 960 520" role="img" aria-label={`Wiremap result: ${result.summary}`}>
        <rect x="0" y="0" width="960" height="520" fill="white" />
        {pins.map((wire) => {
          const y = yFor(wire);
          const label = wire === 9 ? 'S' : wire;
          return (
            <g key={String(wire)}>
              <text x="38" y={y + 8} className="pin-label">
                {label}
              </text>
              <text x="917" y={y + 8} className="pin-label">
                {label}
              </text>
              {line(wire, 85, y, 245, y, `${wire}-left`)}
              {line(wire, 715, y, 875, y, `${wire}-right`)}
            </g>
          );
        })}
        {pins.map((wire) => {
          const destination = result.connections[wire];
          if (destination > 0 && destination < 10)
            return line(wire, 245, yFor(wire), 715, yFor(destination), `${wire}-connection`);
          if (destination === 255)
            return (
              <g key={`${wire}-unknown`}>
                {line(wire, 245, yFor(wire), 452, yFor(wire), `${wire}-unknown-line`)}
                <text x="480" y={yFor(wire) + 12} className="unknown-label">
                  ?
                </text>
              </g>
            );
          return null;
        })}
        {shorts.map(({ low, high, x }) => (
          <g key={`${low}-${high}-short`} className="short-circuit">
            <line x1={x} y1={yFor(low)} x2={x} y2={yFor(high)} />
            <circle cx={x} cy={yFor(low)} r="10" />
            <circle cx={x} cy={yFor(high)} r="10" />
          </g>
        ))}
      </svg>
      {result.id > 0 && (
        <div className="wiremap-footer">
          <strong>Wiremap ID: {result.id}</strong>
        </div>
      )}
    </div>
  );
}
