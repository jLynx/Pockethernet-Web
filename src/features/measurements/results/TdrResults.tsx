import { useState, type PointerEvent, type ReactElement } from 'react';
import { tdrSampleDistance, type TdrResult } from '@/pockethernetProtocol';
import { distanceForUnits, distanceUnitLabel, pairColorsForTia } from '@/app/format';
import type { ChartSeries, TdrGraphResult, TiaStandard, Units } from '@/app/types';

const impedanceSeries: ChartSeries[] = [
  { label: 'Pair 2', color: '#ff941e' },
  { label: 'Pair 3', color: '#17a12a' },
  { label: 'Pair 1', color: '#1049cf' },
  { label: 'Pair 4', color: '#a56a2c' },
];

const crosstalkSeries: ChartSeries[] = [
  { label: 'Pair 2-3', color: '#000000' },
  { label: 'Pair 2-1', color: '#0000ff' },
  { label: 'Pair 2-4', color: '#00b8c8' },
  { label: 'Pair 3-1', color: '#d000d0' },
  { label: 'Pair 3-4', color: '#e32323' },
  { label: 'Pair 1-4', color: '#12a52b' },
];

interface TdrLineChartProps {
  title: string;
  traces: number[][];
  series: ChartSeries[];
  nvp: number;
  units: Units;
}

function TdrLineChart({ title, traces, series, nvp, units }: TdrLineChartProps): ReactElement {
  const [cursor, setCursor] = useState<number | null>(null);
  const width = 720;
  const height = 270;
  const left = 72;
  const right = 16;
  const top = 18;
  const bottom = 48;
  const firstSample = 32;
  const count = Math.min(...traces.map((trace) => trace.length));
  const fullValues = traces.flatMap((trace) => trace.slice(firstSample, count));
  const fullRange = Math.max(0, ...fullValues) - Math.min(0, ...fullValues);
  const tolerance = Math.max(2, fullRange * 0.06);
  let signalEnd = firstSample;
  traces.forEach((trace) => {
    const tailValue = trace[count - 1] ?? 0;
    for (let index = count - 1; index >= firstSample; index -= 1) {
      if (Math.abs(trace[index] - tailValue) > tolerance) {
        signalEnd = Math.max(signalEnd, index);
        break;
      }
    }
  });
  const margin = Math.max(10, Math.round((count - firstSample) * 0.08));
  const lastSample = Math.max(firstSample + 20, Math.min(count - 1, signalEnd + margin));
  const distance = (sample: number): number =>
    distanceForUnits(tdrSampleDistance(sample, nvp), units);
  const xMin = distance(firstSample);
  const xMax = distance(lastSample);
  const values = traces.flatMap((trace) => trace.slice(firstSample, lastSample + 1));
  const dataMin = Math.min(0, ...values);
  const dataMax = Math.max(0, ...values);
  const padding = Math.max(1, (dataMax - dataMin) * 0.12);
  const yMin = dataMin - padding;
  const yMax = dataMax + padding;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (sample: number): number =>
    left + ((distance(sample) - xMin) / Math.max(1, xMax - xMin)) * plotWidth;
  const y = (value: number): number =>
    top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
  const xTicks = [1, 2].map((part) =>
    Math.round(firstSample + ((lastSample - firstSample) * part) / 3),
  );
  const yTicks = Array.from({ length: 6 }, (_, index) => yMax - ((yMax - yMin) * index) / 5);
  const paths = traces.map((trace) => {
    let path = '';
    for (let sample = firstSample; sample <= lastSample; sample += 1)
      path += `${sample === firstSample ? 'M' : 'L'}${x(sample).toFixed(1)},${y(trace[sample]).toFixed(1)} `;
    return path;
  });
  const selectAtPointer = (event: PointerEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (localX - left) / plotWidth));
    setCursor(Math.round(firstSample + ratio * (lastSample - firstSample)));
  };

  return (
    <figure className="tdr-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} by distance`}
        onPointerDown={selectAtPointer}
        onPointerMove={(event) => {
          if (event.buttons) selectAtPointer(event);
        }}
      >
        <line x1={left} y1={y(0)} x2={width - right} y2={y(0)} className="tdr-chart-zero" />
        {yTicks.map((tick, index) => (
          <g key={`y-${index}`}>
            <line
              x1={left}
              y1={y(tick)}
              x2={width - right}
              y2={y(tick)}
              className="tdr-chart-grid"
            />
            <text x={left - 9} y={y(tick) + 5} textAnchor="end" className="tdr-chart-tick">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((sample) => (
          <g key={sample}>
            <line
              x1={x(sample)}
              y1={top}
              x2={x(sample)}
              y2={height - bottom}
              className="tdr-chart-grid"
            />
            <text x={x(sample)} y={height - 25} className="tdr-chart-tick">
              {distance(sample).toFixed(1)}
            </text>
          </g>
        ))}
        <line x1={left} y1={top} x2={left} y2={height - bottom} className="tdr-chart-axis" />
        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          className="tdr-chart-axis"
        />
        {paths.map((path, index) => (
          <path
            key={series[index].label}
            d={path}
            fill="none"
            stroke={series[index].color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {cursor !== null && (
          <line
            x1={x(cursor)}
            y1={top}
            x2={x(cursor)}
            y2={height - bottom}
            className="tdr-chart-cursor"
          />
        )}
        {cursor !== null && (
          <g className="tdr-chart-readout">
            <rect x={width - 244} y={top + 7} width="216" height={32 + series.length * 22} rx="4" />
            <text x={width - 232} y={top + 29}>
              Distance = {distance(cursor).toFixed(1)} {distanceUnitLabel(units)}
            </text>
            {series.map((item, index) => (
              <text key={item.label} x={width - 232} y={top + 53 + index * 22} fill={item.color}>
                {item.label} = {traces[index][cursor] ?? 0}
              </text>
            ))}
          </g>
        )}
        <text
          transform={`translate(22 ${top + plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          className="tdr-chart-title"
        >
          {title}
        </text>
        <text
          x={left + plotWidth / 2}
          y={height - 3}
          textAnchor="middle"
          className="tdr-chart-axis-label"
        >
          Distance ({distanceUnitLabel(units)})
        </text>
      </svg>
      <figcaption>Tap or drag across the graph to inspect a distance.</figcaption>
    </figure>
  );
}

export function TdrGraphs({
  result,
  units,
  tia,
}: {
  result: TdrGraphResult | null;
  units: Units;
  tia: TiaStandard;
}): ReactElement {
  if (!result)
    return (
      <div className="tdr-awaiting">Run a measurement to see impedance and crosstalk traces</div>
    );
  const colors = pairColorsForTia(tia);
  const series = impedanceSeries.map((item, index) => ({ ...item, color: colors[index] }));
  return (
    <div className="tdr-graphs">
      <TdrLineChart
        title="Impedance"
        traces={result.impedance}
        series={series}
        nvp={result.nvp}
        units={units}
      />
      <TdrLineChart
        title="Crosstalk"
        traces={result.crosstalk}
        series={crosstalkSeries}
        nvp={result.nvp}
        units={units}
      />
    </div>
  );
}

export function TdrResults({
  result,
  units,
  tia,
}: {
  result: TdrResult | null;
  units: Units;
  tia: TiaStandard;
}): ReactElement {
  if (!result)
    return <div className="tdr-awaiting">Run a measurement to see cable length and status</div>;
  const pairLabels = ['2', '3', '1', '4'];
  const pairColors = pairColorsForTia(tia);
  return (
    <div className="tdr-results">
      <div className="tdr-row tdr-header">
        <span>Pair</span>
        <span>Status</span>
        <span>Distance</span>
      </div>
      {result.pairs.map((pair, index) => (
        <div className="tdr-row" key={pairLabels[index]}>
          <strong style={{ color: pairColors[index] }}>{pairLabels[index]}</strong>
          <span>{pair.status || '-'}</span>
          <span>
            {pair.status
              ? `${distanceForUnits(pair.distance, units).toFixed(1)} ${distanceUnitLabel(units)}`
              : '-'}
          </span>
        </div>
      ))}
    </div>
  );
}
