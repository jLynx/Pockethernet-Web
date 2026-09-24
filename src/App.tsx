import { useEffect, useState, type ReactElement } from 'react';
import logo from '@/assets/logo.png';
import {
  blinkerCommand,
  parseFirmwareVersionResponse,
  tonerCommand,
  tonerStopCommand,
  wifiBridgeCommand,
  wifiBridgeEthernetCommand,
  type CdpLldpResult,
  type FieldsResult,
  type Ipv6Mode,
  type LinkResult,
  type PoeResult,
  type TdrResult,
  type WiremapResult,
} from '@/pockethernetProtocol';
import { errorMessage } from '@/app/format';
import { runMeasurements } from '@/app/runMeasurements';
import {
  loadBlinkerSettings,
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
  type FirmwareCheck,
  type Ipv4UiSettings,
  type Ipv6DisplayResult,
  type PingDisplayResult,
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
import { usePockethernet } from '@/device/usePockethernet';

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
  const ble = usePockethernet();
  const [tab, setTab] = useState<Tab>('test');
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
  const [pingTargets, setPingTargets] = useState(['', '', '']);
  const [toolSettings, setToolSettings] = useState<ToolSettings>(loadToolSettings);
  const [blinkerSettings, setBlinkerSettings] = useState<BlinkerSettings>(loadBlinkerSettings);
  const [tonerSettings, setTonerSettings] = useState<TonerSettings>(loadTonerSettings);
  const [wifiSettings, setWifiSettings] = useState<WifiSettings>(loadWifiSettings);
  const [reportDetails, setReportDetails] = useState<ReportDetails>(loadReportDetails);
  const [reportPreferences, setReportPreferences] =
    useState<ReportPreferences>(loadReportPreferences);
  const [reports, setReports] = useState<SavedReport[]>(loadReports);
  const [running, setRunning] = useState(false);
  const [activeTest, setActiveTest] = useState<TestId | null>(null);
  const [notice, setNotice] = useState('');
  const [firmwareCheck, setFirmwareCheck] = useState<FirmwareCheck | null>(null);
  const [firmwareChecking, setFirmwareChecking] = useState(false);

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
    setFirmwareCheck(null);
  }, [ble.status]);
  useEffect(() => {
    localStorage.setItem('pockethernet.toolSettings', JSON.stringify(toolSettings));
  }, [toolSettings]);
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

  const checkFirmware = async (): Promise<void> => {
    if (!ble.info) {
      setNotice('Connect Pockethernet first.');
      return;
    }
    setFirmwareChecking(true);
    setFirmwareCheck(null);
    try {
      const response = await fetch('/api/latest-version');
      if (!response.ok) throw new Error(`Update server returned ${response.status}`);
      setFirmwareCheck(parseFirmwareVersionResponse(await response.text(), ble.info.espVersion));
    } catch (error) {
      const message = errorMessage(error);
      setFirmwareCheck({
        error: message.includes('Failed to fetch') ? 'Could not reach the update server' : message,
      });
    } finally {
      setFirmwareChecking(false);
    }
  };

  const applyBlinker = async (
    settings: BlinkerSettings,
    tonerActive: boolean,
  ): Promise<boolean> => {
    if (ble.status !== 'connected' || running || tonerActive) {
      setNotice(
        ble.status !== 'connected'
          ? 'Connect Pockethernet first.'
          : running
            ? 'Main measurements running'
            : 'Disable toner first',
      );
      return false;
    }
    try {
      await ble.send(blinkerCommand(settings.speed, settings.duplex, settings.mdi, settings.link));
      return true;
    } catch (error) {
      setNotice(`Blinker failed: ${errorMessage(error)}`);
      return false;
    }
  };

  const applyToner = async (settings: TonerSettings, blinkerActive: boolean): Promise<boolean> => {
    if (ble.status !== 'connected' || running || blinkerActive) {
      setNotice(
        ble.status !== 'connected'
          ? 'Connect Pockethernet first.'
          : running
            ? 'Main measurements running'
            : 'Disable Blinker function first',
      );
      return false;
    }
    try {
      await ble.send(
        settings.power === 'on'
          ? tonerCommand(settings.pair, settings.shield, settings.tone, settings.volume)
          : tonerStopCommand(),
      );
      return true;
    } catch (error) {
      setNotice(`Toner failed: ${errorMessage(error)}`);
      return false;
    }
  };

  const applyWifi = async (settings: WifiSettings): Promise<boolean> => {
    if (ble.status !== 'connected' || running) {
      setNotice(
        ble.status !== 'connected' ? 'Connect Pockethernet first.' : 'Main measurements running',
      );
      return false;
    }
    try {
      if (settings.enabled === 'on') {
        await ble.send(wifiBridgeEthernetCommand());
        await ble.send(wifiBridgeCommand(true, settings.name, settings.password));
      } else {
        await ble.send(wifiBridgeCommand(false));
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      return true;
    } catch (error) {
      setNotice(`WiFi bridge failed: ${errorMessage(error)}`);
      return false;
    }
  };

  const measure = async (): Promise<void> => {
    if (ble.status !== 'connected') {
      setNotice('Connect Pockethernet first.');
      return;
    }
    if (!SUPPORTED_TESTS.some((id) => selected.has(id))) {
      setNotice('Select at least one supported test first.');
      return;
    }
    await runMeasurements({
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
            onClick={() => {
              void connect();
            }}
          />
        </div>
      </header>
      <MainNav tab={tab} onChange={setTab} />
      {tab === 'test' ? (
        <TestPage
          selected={selected}
          expanded={expanded}
          onToggle={toggle}
          onExpandedChange={setExpanded}
          running={running}
          activeTest={activeTest}
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
          firmwareCheck={firmwareCheck}
          firmwareChecking={firmwareChecking}
          onCheckFirmware={checkFirmware}
          settings={toolSettings}
          onSettingsChange={setToolSettings}
          blinkerSettings={blinkerSettings}
          onBlinkerSettingsChange={setBlinkerSettings}
          onBlinkerChange={applyBlinker}
          tonerSettings={tonerSettings}
          onTonerSettingsChange={setTonerSettings}
          onTonerChange={applyToner}
          wifiSettings={wifiSettings}
          onWifiSettingsChange={setWifiSettings}
          onWifiChange={applyWifi}
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
          canMeasure={SUPPORTED_TESTS.some((id) => selected.has(id))}
          onMeasure={() => {
            void measure();
          }}
        />
      )}
      <AppFooter />
      {(notice || ble.error) && (
        <Toast
          message={notice || ble.error}
          onDismiss={() => {
            setNotice('');
          }}
        />
      )}
    </div>
  );
}
