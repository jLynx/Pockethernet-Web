import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { WebBluetoothGate } from './shared/layout/WebBluetoothGate';
import './shared/ui/primitives.css';
import './styles.css';
import './shared/layout/layout.css';
import './features/measurements/results/results.css';
import './features/tools/tools.css';
import './features/measurements/test-help.css';
import './features/reports/reports.css';
import './features/measurements/results/wiremap.css';
import './features/measurements/results/tdr.css';

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    void registration.update();
    window.setInterval(() => void registration.update(), 60 * 60 * 1000);
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <WebBluetoothGate>
      <App />
    </WebBluetoothGate>
  </StrictMode>,
);
