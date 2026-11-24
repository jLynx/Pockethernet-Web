import type { ReactElement } from 'react';
import { ToolPanel } from '@/features/tools/ToolControls';
import { pairColorsForTia, wiremapPairIndex } from '@/app/format';

const LED_COLORS = {
  blue: '#2683db',
  yellow: '#d59a0c',
  green: '#24a061',
  red: '#e44e4e',
  white: '#fff',
} as const;
type LedColor = keyof typeof LED_COLORS;

const POWER_LEDS = [
  ['Blue', 'Powered on', '—', 'blue'],
  ['Blue, flashing', 'Battery low', '—', 'blue'],
  ['Yellow', 'Charging', 'Charging', 'yellow'],
  ['Green', 'Charged', 'Charged', 'green'],
  ['Red', 'Charge error', 'Charge error', 'red'],
] as const;
const QUICK_TEST = [
  ['Cable/PoE green', 'Wiremap adapter found. The quick test ends here.', 'green'],
  ['Cable/PoE yellow', 'Cable open', 'yellow'],
  ['Cable/PoE white', 'Something at the far end, with no wiremap adapter', 'white'],
  ['Cable/PoE blue', 'PoE present', 'blue'],
  ['Link green', 'Link up at 10 or 100 Mbit/s', 'green'],
  ['Network green', 'DHCP address received', 'green'],
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

function LedLabel({ label, color }: { label: string; color: LedColor }): ReactElement {
  return (
    <span className="tester-led-label">
      <span
        className="tester-led"
        style={{ backgroundColor: LED_COLORS[color] }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function ReferenceList({
  rows,
}: {
  rows: readonly (readonly [string, string, LedColor?])[];
}): ReactElement {
  return (
    <dl className="tester-reference-list">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <dt>{color ? <LedLabel label={label} color={color} /> : label}</dt>
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
                  <LedLabel label={label} color={color} />
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
        <div className="tester-pinouts">
          {(['568A', '568B'] as const).map((tia) => {
            const colors = pairColorsForTia(tia);
            const colorNames =
              tia === '568A'
                ? ['green', 'orange', 'blue', 'brown']
                : ['orange', 'green', 'blue', 'brown'];
            return (
              <figure className="tester-pinout" key={tia}>
                <figcaption>T{tia} pairs</figcaption>
                <ol aria-label={`T${tia} pins`}>
                  {Array.from({ length: 8 }, (_, index) => {
                    const pin = index + 1;
                    const pair = wiremapPairIndex(pin);
                    const striped = pin % 2 !== 0;
                    return (
                      <li
                        key={pin}
                        aria-label={`Pin ${pin}, ${striped ? 'white and ' : ''}${colorNames[pair]}`}
                      >
                        {pin}
                        <span
                          className={striped ? 'striped' : ''}
                          style={{ backgroundColor: colors[pair] }}
                        />
                      </li>
                    );
                  })}
                </ol>
              </figure>
            );
          })}
        </div>
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
