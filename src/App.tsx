import { useCallback, useEffect, useState, type ReactElement } from 'react';
import logo from '@/assets/logo.png';
import {
  type CdpLldpResult,
  type FieldsResult,
  type Ipv6Mode,
  type LinkResult,
  type PoeResult,
  type TdrResult,
  type WiremapResult,
} from '@/pockethernetProtocol';
import { errorMessage } from '@/app/format';
import { runMeasurementsWithNotifications } from '@/features/notifications/measurementNotifications';
import {
  loadBlinkerSettings,
  loadPingDefaults,
  loadReportDetails,
  loadReportPreferences,
  loadReports,
  loadTonerSettings,
  loadToolSettings,
  loadWifiSettings,
} from '@/app/storage';
import {
  SUPPORTED_TESTS,
  type BerDisplayResult,
  type BerSettings,
  type BlinkerSettings,
  type DiscoveryFailure,
  type Ipv4UiSettings,
  type Ipv6DisplayResult,
  type MeasurementFailures,
  type PingDisplayResult,
  type PingDefaults,
  type ReportDetails,
  type ReportPreferences,
  type ReportResults,
  type SavedReport,
  type Tab,
  type TdrGraphResult,
  type TestId,
  type TonerSettings,
  type ToolSettings,
  type TrafficDisplayResult,
  type VlanDisplayResult,
  type VlanSettings,
  type WifiSettings,
} from '@/app/types';
import { TestPage } from '@/features/measurements/TestPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ToolsPage } from '@/features/tools/ToolsPage';
import {
  ActionDock,
  AppFooter,
  ConnectionButton,
  GitHubLink,
  Toast,
} from '@/shared/layout/AppControls';
import { MainNav } from '@/shared/layout/Layout';
import { AppUpdate } from '@/shared/layout/AppUpdate';
import { usePockethernet } from '@/device/usePockethernet';
import { useDeviceTools } from '@/features/tools/useDeviceTools';
import { useFirmwareUpdater } from '@/features/firmware/useFirmwareUpdater';
import { readPendingUpdate } from '@/features/firmware/updateRecovery';
import { updateLocked, updateWorking } from '@/features/firmware/firmwareUpdateController';
import { Button } from '@/shared/ui/UiPrimitives';
import { initialPingTargets, updatePingTargets } from '@/app/pingDefaults';

const LINK_DEPENDENT_TESTS: readonly TestId[] = [
  'cdplldp',
  'vlan',
  'traffic',
  'ipv4',
  'ipv6',
  'ping',
  'extip',
];

export default function App(): ReactElement {
  const [tab, setTab] = useState<Tab>('test');
  useEffect(() => {
    const openResults = (event: MessageEvent<unknown>): void => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'pocketweb-open-results'
      )
        setTab('test');
    };
    navigator.serviceWorker?.addEventListener('message', openResults);
    window.addEventListener('message', openResults);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', openResults);
      window.removeEventListener('message', openResults);
    };
  }, []);
  const [selected, setSelected] = useState<Set<TestId>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<TestId>>(() => new Set());
  const [wiremap, setWiremap] = useState<WiremapResult | null>(null);
  const [tdr, setTdr] = useState<TdrResult | null>(null);
  const [tdrGraph, setTdrGraph] = useState<TdrGraphResult | null>(null);
  const [ber, setBer] = useState<BerDisplayResult | null>(null);
  const [poe, setPoe] = useState<PoeResult | null>(null);
  const [link, setLink] = useState<LinkResult | null>(null);
  const [cdplldp, setCdplldp] = useState<CdpLldpResult | DiscoveryFailure | null>(null);
  const [vlan, setVlan] = useState<VlanDisplayResult | null>(null);
  const [traffic, setTraffic] = useState<TrafficDisplayResult | null>(null);
  const [ipv4, setIpv4] = useState<FieldsResult | null>(null);
  const [ipv6, setIpv6] = useState<Ipv6DisplayResult | null>(null);
  const [extip, setExtip] = useState<FieldsResult | null>(null);
  const [ping, setPing] = useState<PingDisplayResult | null>(null);
  const [berSettings, setBerSettings] = useState<BerSettings>({
    speed: 1000,
    frameSize: 'both',
    payloadMode: 'random',
    total: 100000,
  });
  const [vlanSettings, setVlanSettings] = useState<VlanSettings>({ tagging: false, id: '' });
  const [ipv4Settings, setIpv4Settings] = useState<Ipv4UiSettings>({
    mode: 'dhcp',
    ip: '',
    netmask: '',
    gateway: '',
    dns: '',
  });
  const [ipv6Mode, setIpv6Mode] = useState<Ipv6Mode>('slaac');
  const [pingDefaults, setPingDefaults] = useState<PingDefaults>(loadPingDefaults);
  const [pingTargets, setPingTargets] = useState(() => initialPingTargets(pingDefaults));
  const changePingDefaults = (next: PingDefaults): void => {
    setPingTargets((current) => updatePingTargets(current, pingDefaults, next));
    setPingDefaults(next);
  };
  const [toolSettings, setToolSettings] = useState<ToolSettings>(loadToolSettings);
  const [blinkerSettings, setBlinkerSettings] = useState<BlinkerSettings>(loadBlinkerSettings);
  const [tonerSettings, setTonerSettings] = useState<TonerSettings>(loadTonerSettings);
  const [wifiSettings, setWifiSettings] = useState<WifiSettings>(loadWifiSettings);
  const [reportDetails, setReportDetails] = useState<ReportDetails>(loadReportDetails);
  const [reportPreferences, setReportPreferences] =
    useState<ReportPreferences>(loadReportPreferences);
  const [reports, setReports] = useState<SavedReport[]>(loadReports);
  const [running, setRunning] = useState(false);
  const [firmwareLocked, setFirmwareLocked] = useState(
    () => !!readPendingUpdate(window.localStorage),
  );
  const ble = usePockethernet({ pollBattery: !running && !firmwareLocked });
  const [notice, setNotice] = useState('');
  const deviceTools = useDeviceTools({ client: ble, running, firmwareLocked, onNotice: setNotice });
  const firmwareUpdater = useFirmwareUpdater({
    client: ble,
    onLockChange: setFirmwareLocked,
    blockedReason: deviceTools.busy
      ? 'Wait for the current device command to finish.'
      : running
        ? 'Wait for measurements to finish.'
        : tonerSettings.power === 'on'
          ? 'Turn off the cable toner first.'
          : blinkerSettings.link !== 'off'
            ? 'Turn off the link blinker first.'
            : wifiSettings.enabled === 'on'
              ? 'Turn off the WiFi bridge first.'
              : '',
  });
  const deviceLocked = updateLocked(firmwareUpdater.state);
  const [activeTest, setActiveTest] = useState<TestId | null>(null);
  const [measurementFailures, setMeasurementFailures] = useState<MeasurementFailures>({});
  const [pendingTests, setPendingTests] = useState<Set<TestId>>(new Set());
  const clearError = ble.clearError;
  const dismissNotice = useCallback(() => {
    setNotice('');
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (ble.status !== 'disconnected') return;
    setWiremap(null);
    setTdr(null);
    setTdrGraph(null);
    setBer(null);
    setPoe(null);
    setLink(null);
    setCdplldp(null);
    setVlan(null);
    setTraffic(null);
    setIpv4(null);
    setIpv6(null);
    setExtip(null);
    setPing(null);
  }, [ble.status]);
  useEffect(() => {
    localStorage.setItem('pockethernet.toolSettings', JSON.stringify(toolSettings));
  }, [toolSettings]);
  useEffect(() => {
    localStorage.setItem('pockethernet.pingDefaults', JSON.stringify(pingDefaults));
  }, [pingDefaults]);
  useEffect(() => {
    localStorage.setItem('pockethernet.blinkerSettings', JSON.stringify(blinkerSettings));
  }, [blinkerSettings]);
  useEffect(() => {
    localStorage.setItem('pockethernet.tonerSettings', JSON.stringify(tonerSettings));
  }, [tonerSettings]);
  useEffect(() => {
    localStorage.setItem('pockethernet.wifiSettings', JSON.stringify(wifiSettings));
  }, [wifiSettings]);
  useEffect(() => {
    localStorage.setItem('pockethernet.reportDetails', JSON.stringify(reportDetails));
  }, [reportDetails]);
  useEffect(() => {
    localStorage.setItem('pockethernet.reportPreferences', JSON.stringify(reportPreferences));
  }, [reportPreferences]);
  useEffect(() => {
    localStorage.setItem('pockethernet.reports', JSON.stringify(reports));
  }, [reports]);

  const currentResults: ReportResults = {
    wiremap,
    tdr,
    tdrGraph,
    ber,
    poe,
    link,
    cdplldp,
    vlan,
    traffic,
    ipv4,
    ipv6,
    ping,
    extip,
  };

  const toggle = (id: TestId): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (id === 'ipv4' && (next.has('extip') || next.has('ping'))) return next;
      const requiresLink =
        id === 'cdplldp' ||
        id === 'vlan' ||
        id === 'traffic' ||
        id === 'ipv4' ||
        id === 'ipv6' ||
        id === 'ping' ||
        id === 'extip';
      if (requiresLink) {
        if (next.has(id)) next.delete(id);
        else {
          next.add(id);
          next.add('link');
          if (id === 'extip' || id === 'ping') next.add('ipv4');
        }
        return next;
      }
      if (id === 'link' && LINK_DEPENDENT_TESTS.some((dependency) => next.has(dependency)))
        return next;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const connect = async (): Promise<void> => {
    if (updateWorking(firmwareUpdater.state)) return;
    try {
      if (ble.status === 'connected') ble.disconnect();
      else await ble.connect();
    } catch (error) {
      const message = errorMessage(error);
      if (
        !(error instanceof DOMException && error.name === 'NotFoundError') &&
        !message.toLowerCase().includes('cancel')
      )
        setNotice(message);
    }
  };

  const measure = async (): Promise<void> => {
    if (deviceLocked || running || deviceTools.busy) return;
    if (ble.status !== 'connected') {
      setNotice('Connect Pockethernet first.');
      return;
    }
    if (!SUPPORTED_TESTS.some((id) => selected.has(id))) {
      setNotice('Select at least one supported test first.');
      return;
    }
    await runMeasurementsWithNotifications({
      ble,
      selected,
      setExpanded,
      toolSettings,
      berSettings,
      vlanSettings,
      ipv4Settings,
      ipv6Mode,
      pingTargets,
      setRunning,
      setActiveTest,
      setFailures: setMeasurementFailures,
      setPendingTests,
      setNotice,
      setWiremap,
      setTdr,
      setTdrGraph,
      setBer,
      setPoe,
      setLink,
      setCdplldp,
      setVlan,
      setTraffic,
      setIpv4,
      setIpv6,
      setPing,
      setExtip,
    });
  };

  return (
    <div className="original-app">
      <header className="original-header">
        <img className="wordmark" src={logo} alt="Pocketweb for Pockethernet" />
        <div className="header-actions">
          <GitHubLink />
          <ConnectionButton
            status={ble.status}
            batteryPercent={ble.batteryPercent}
            disabled={updateWorking(firmwareUpdater.state)}
            onClick={() => {
              void connect();
            }}
          />
        </div>
      </header>
      <MainNav tab={tab} onChange={setTab} />
      <AppUpdate busy={running || deviceLocked || deviceTools.busy} />
      {deviceLocked && tab !== 'tools' && (
        <div className="firmware-banner" role="status">
          <span>
            {updateWorking(firmwareUpdater.state)
              ? 'Firmware update in progress'
              : 'Firmware update needs verification'}
          </span>
          <Button onClick={() => setTab('tools')}>View update</Button>
        </div>
      )}
      {tab === 'test' ? (
        <TestPage
          selected={selected}
          expanded={expanded}
          onToggle={toggle}
          onExpandedChange={setExpanded}
          running={running}
          activeTest={activeTest}
          failures={measurementFailures}
          pendingTests={pendingTests}
          toolSettings={toolSettings}
          wiremap={wiremap}
          tdr={tdr}
          tdrGraph={tdrGraph}
          ber={ber}
          poe={poe}
          link={link}
          cdplldp={cdplldp}
          vlan={vlan}
          traffic={traffic}
          ipv4={ipv4}
          ipv6={ipv6}
          extip={extip}
          ping={ping}
          berSettings={berSettings}
          onBerSettingsChange={setBerSettings}
          vlanSettings={vlanSettings}
          onVlanSettingsChange={setVlanSettings}
          ipv4Settings={ipv4Settings}
          onIpv4SettingsChange={setIpv4Settings}
          ipv6Mode={ipv6Mode}
          onIpv6ModeChange={setIpv6Mode}
          pingTargets={pingTargets}
          onPingTargetsChange={setPingTargets}
        />
      ) : tab === 'tools' ? (
        <ToolsPage
          deviceInfo={ble.info}
          firmwareUpdater={firmwareUpdater}
          firmwareLocked={deviceLocked}
          settings={toolSettings}
          onSettingsChange={setToolSettings}
          pingDefaults={pingDefaults}
          onPingDefaultsChange={changePingDefaults}
          blinkerSettings={blinkerSettings}
          onBlinkerSettingsChange={setBlinkerSettings}
          onBlinkerChange={deviceTools.applyBlinker}
          tonerSettings={tonerSettings}
          onTonerSettingsChange={setTonerSettings}
          onTonerChange={deviceTools.applyToner}
          wifiSettings={wifiSettings}
          onWifiSettingsChange={setWifiSettings}
          onWifiChange={deviceTools.applyWifi}
          reportPreferences={reportPreferences}
          onReportPreferencesChange={setReportPreferences}
          onNotice={setNotice}
        />
      ) : (
        <ReportsPage
          details={reportDetails}
          onDetailsChange={setReportDetails}
          preferences={reportPreferences}
          reports={reports}
          onReportsChange={setReports}
          currentResults={currentResults}
          toolSettings={toolSettings}
          onNotice={setNotice}
        />
      )}
      {tab === 'test' && (
        <ActionDock
          status={ble.status}
          selectedCount={selected.size}
          running={running}
          canMeasure={!deviceLocked && SUPPORTED_TESTS.some((id) => selected.has(id))}
          onMeasure={() => {
            void measure();
          }}
        />
      )}
      <AppFooter />
      {(notice || ble.error) && <Toast message={notice || ble.error} onDismiss={dismissNotice} />}
    </div>
  );
}
