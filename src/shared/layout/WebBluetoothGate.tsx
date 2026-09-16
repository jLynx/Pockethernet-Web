import type { ReactElement, ReactNode } from 'react';
import pockethernetWordmark from '@/assets/pockethernet-wordmark.png';

type DeviceFamily = 'ios' | 'android' | 'desktop';

function getDeviceFamily(): DeviceFamily {
  const userAgent = navigator.userAgent;
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/i.test(userAgent) || isIPadOS) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

function SupportLink({ device }: { device: DeviceFamily }): ReactElement {
  if (device === 'ios') {
    return (
      <a
        className="support-link"
        href="https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055"
        target="_blank"
        rel="noreferrer"
      >
        Get Bluefy from the App Store
      </a>
    );
  }

  if (device === 'android') {
    return (
      <a
        className="support-link"
        href="https://play.google.com/store/apps/details?id=com.android.chrome"
        target="_blank"
        rel="noreferrer"
      >
        Get Google Chrome
      </a>
    );
  }

  return (
    <div className="support-links">
      <a
        className="support-link"
        href="https://www.google.com/chrome/"
        target="_blank"
        rel="noreferrer"
      >
        Get Google Chrome
      </a>
      <a
        className="support-link secondary"
        href="https://www.microsoft.com/edge/download"
        target="_blank"
        rel="noreferrer"
      >
        Get Microsoft Edge
      </a>
    </div>
  );
}

export function WebBluetoothGate({ children }: { children: ReactNode }): ReactElement {
  const supported = window.isSecureContext && 'bluetooth' in navigator;
  if (supported) return <>{children}</>;

  const device = getDeviceFamily();
  const recommendation =
    device === 'ios'
      ? 'Safari and other standard iPhone browsers do not expose Web Bluetooth. Open this site in Bluefy, a browser built to provide Web BLE on iOS.'
      : device === 'android'
        ? 'Open this site in the latest version of Google Chrome for Android, which supports Web Bluetooth.'
        : 'Open this site in the latest version of Google Chrome or Microsoft Edge on a Bluetooth-capable computer.';

  return (
    <main className="support-page">
      <section className="support-panel" aria-labelledby="support-title">
        <img className="support-wordmark" src={pockethernetWordmark} alt="Pockethernet" />
        <div className="support-status" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">Browser compatibility</p>
        <h1 id="support-title">Web Bluetooth is not available here</h1>
        <p className="support-lead">{recommendation}</p>
        <SupportLink device={device} />
        <div className="support-explanation">
          <h2>Why is a specific browser required?</h2>
          <p>
            Pockethernet communicates directly with your device over Bluetooth Low Energy. A web
            page can only do that through the browser's Web Bluetooth API. Some browsers and
            operating systems do not provide this API, so JavaScript cannot request Bluetooth access
            or work around the restriction.
          </p>
          <p>
            This is a browser platform limitation, not a missing shortcut in this site. The
            connection also requires a secure HTTPS page and permission from you before any device
            can be accessed.
          </p>
        </div>
      </section>
    </main>
  );
}
