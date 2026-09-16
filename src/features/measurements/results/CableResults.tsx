import type { ReactElement } from 'react';
import type { LinkResult, PoeResult } from '@/pockethernetProtocol';
import { pairColorsForTia } from '@/app/format';
import type { TiaStandard } from '@/app/types';
import { DataRow, EmptyState, SectionTitle } from '@/shared/ui/UiPrimitives';

export function PoeResults({
  result,
  tia,
}: {
  result: PoeResult | null;
  tia: TiaStandard;
}): ReactElement {
  if (!result)
    return (
      <EmptyState className="poe-awaiting">
        Run a measurement to detect PoE and pair polarity
      </EmptyState>
    );
  const pairColors = pairColorsForTia(tia);
  const pairDisplay = [
    { label: '2', color: pairColors[0], value: result.pairVoltages[0] },
    { label: '3', color: pairColors[1], value: result.pairVoltages[1] },
    { label: '1', color: pairColors[2], value: result.pairVoltages[2] },
    { label: '4', color: pairColors[3], value: result.pairVoltages[3] },
  ];
  const rows = [
    ['PSE type', result.poeType],
    ['Open circuit', `${result.openVoltage} V`],
    ['With load', `${result.loadVoltage} V`],
    ['Polarity', result.polarity || '---'],
  ];
  if (result.maxClass) rows.push(['Maximum class', result.maxClass]);
  return (
    <div className="poe-results">
      {rows.map(([label, value]) => (
        <DataRow className="poe-row" key={label} label={label} value={value} />
      ))}
      <SectionTitle className="poe-pairs-title">Same-pair supply</SectionTitle>
      {pairDisplay.map(({ label, color, value }) => (
        <DataRow
          className="poe-row poe-pair"
          key={label}
          label={<span style={{ color }}>Pair {label}</span>}
          value={`${value} V`}
        />
      ))}
    </div>
  );
}

export function LinkResults({
  result,
  tia,
}: {
  result: LinkResult | null;
  tia: TiaStandard;
}): ReactElement {
  if (!result)
    return (
      <EmptyState className="link-awaiting">
        Run a measurement to see link negotiation details
      </EmptyState>
    );
  if (!result.linkUp)
    return (
      <EmptyState className="link-no-link" tone="error">
        No link
      </EmptyState>
    );
  const capabilityRows = [
    ['2.5/5/10G', result.partnerCapabilities.multig],
    ['1000 Mbit', result.partnerCapabilities['1000M']],
    ['100 Mbit', result.partnerCapabilities['100M']],
    ['10 Mbit', result.partnerCapabilities['10M']],
  ];
  return (
    <div className="link-results">
      <SectionTitle className="link-section-title">Link partner capabilities</SectionTitle>
      {capabilityRows.map(([label, value]) => (
        <DataRow className="link-row" key={label} label={label} value={value} />
      ))}
      <SectionTitle className="link-section-title">Gigabit info</SectionTitle>
      {result.polarity.map((value, index) => (
        <DataRow
          className="link-row"
          key={`pair-${index}`}
          label={
            <span style={{ color: pairColorsForTia(tia)[index] }}>Pair {[2, 3, 1, 4][index]}</span>
          }
          value={
            <>
              {value}
              <small>{result.skewDelay[index] ?? 0} ns</small>
            </>
          }
        />
      ))}
      <DataRow
        className="link-row"
        label="Length estimate"
        value={result.lengthEstimate === null ? '---' : `${result.lengthEstimate}`}
      />
    </div>
  );
}
