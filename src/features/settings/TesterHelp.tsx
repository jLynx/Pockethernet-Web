import type { ReactElement } from 'react';
import { ToolPanel } from '@/features/tools/ToolControls';
import { pairColorsForTia, wiremapPairIndex } from '@/app/format';

const POWER_LEDS = [
  ['Blue', 'Powered on', '—', '#2683db'],
  ['Blue, flashing', 'Battery low', '—', '#2683db'],
  ['Yellow', 'Charging', 'Charging', '#d59a0c'],
  ['Green', 'Charged', 'Charged', '#24a061'],
  ['Red', 'Charge error', 'Charge error', '#e44e4e'],
] as const;
const QUICK_TEST = [
  ['Cable/PoE green', 'Wiremap adapter found. The quick test ends here.'],
  ['Cable/PoE yellow', 'Cable open'],
  ['Cable/PoE white', 'Something at the far end, with no wiremap adapter'],
  ['Cable/PoE blue', 'PoE present'],
  ['Link green', 'Link up at 10 or 100 Mbit/s'],
  ['Network green', 'DHCP address received'],
] as const;
const BUTTON = [
  ['Press while off', 'Switch on'],
  ['Press once', 'Run a quick test'],
  ['Press twice', 'Toggle the flashlight'],
  [
    'Press three times',
    'Start error-rate loopback. Bluetooth switches off. Power off the tester to exit.',
  ],
  ['Hold 1.5 seconds', 'Switch off'],
] as const;
const POE = [
  ['802.3af (PoE)', 'Up to 15.4 W per port at nominal 48 V, classes 0–3'],
  ['802.3at (PoE+)', 'Up to 30 W per port at nominal 48 V, class 4'],
  ['802.3bt (PoE++)', 'Up to 60 W for Type 3 or 90 W for Type 4 at the power source, classes 5–8'],
  ['Passive PoE', 'Vendor-specific voltage and pin assignments'],
] as const;

function ReferenceList({ rows }: { rows: readonly (readonly [string, string])[] }): ReactElement {
  return (
    <dl className="tester-reference-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TesterHelp(): ReactElement {
  return (
    <ToolPanel title="Tester reference" className="tester-help">
      <details>
        <summary>Tester LEDs and button</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Power LED</th>
              <th scope="col">Powered on</th>
              <th scope="col">With USB</th>
            </tr>
          </thead>
          <tbody>
            {POWER_LEDS.map(([label, powered, usb, color]) => (
              <tr key={label}>
                <th scope="row">
                  <span
                    className="tester-led"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {label}
                </th>
                <td>{powered}</td>
                <td>{usb}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Quick test</h3>
        <p className="settings-hint">
          Press the tester button once while Bluetooth is disconnected.
        </p>
        <ReferenceList rows={QUICK_TEST} />
        <h3>Tester button</h3>
        <ReferenceList rows={BUTTON} />
      </details>
      <details>
        <summary>Quick reference</summary>
        <h3>TIA-568 pinouts</h3>
        {(['568A', '568B'] as const).map((tia) => {
          const colors = pairColorsForTia(tia);
          return (
            <div className="tester-pinout" key={tia}>
              <h4>T{tia}</h4>
              <ol aria-label={`T${tia} pins`}>
                {Array.from({ length: 8 }, (_, index) => {
                  const pin = index + 1;
                  const pair = wiremapPairIndex(pin);
                  const color = (
                    tia === '568A'
                      ? ['green', 'orange', 'blue', 'brown']
                      : ['orange', 'green', 'blue', 'brown']
                  )[pair];
                  return (
                    <li key={pin} aria-label={`Pin ${pin}, ${pin % 2 ? 'white and ' : ''}${color}`}>
                      {pin}
                      <span
                        className={pin % 2 ? 'striped' : ''}
                        style={{ backgroundColor: colors[pair] }}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
        <p className="settings-hint">
          Pair 1 uses pins 4–5, pair 2 uses 1–2, pair 3 uses 3–6, and pair 4 uses 7–8.
        </p>
        <ReferenceList
          rows={[
            ['Straight-through', 'The same standard at both ends'],
            ['Crossover', 'T568A at one end and T568B at the other'],
          ]}
        />
        <h3>PoE standards</h3>
        <ReferenceList rows={POE} />
      </details>
    </ToolPanel>
  );
}
