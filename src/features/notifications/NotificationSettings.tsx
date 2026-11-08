import { useEffect, useState, type ReactElement } from 'react';
import { ToolAction, ToolControl, ToolPanel } from '@/features/tools/ToolControls';
import './notifications.css';
import {
  loadNotificationPreferences,
  notificationsSupported,
  saveNotificationPreferences,
  showResultNotification,
} from './notifications';

export function NotificationSettings(): ReactElement {
  const [preferences, setPreferences] = useState(loadNotificationPreferences);
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const enabled = preferences.enabled && permission === 'granted';
  useEffect(() => {
    const refresh = (): void => {
      setPermission(notificationsSupported() ? Notification.permission : 'unsupported');
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const enable = async (): Promise<void> => {
    setBusy(true);
    setMessage('');
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setMessage(
          result === 'denied'
            ? 'Notifications are blocked. Allow them in your browser’s site settings, then enable them here.'
            : 'Permission was not granted. Use Enable notifications to try again.',
        );
        return;
      }
      const next = { ...preferences, enabled: true };
      saveNotificationPreferences(next);
      setPreferences(next);
      setMessage('Enabled. Send a test notification to check your watch.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  };
  const test = async (): Promise<void> => {
    setBusy(true);
    try {
      let image: string | undefined;
      if (preferences.images) {
        const { wiremapNotificationImage } = await import('./wiremapImage');
        image = wiremapNotificationImage(
          {
            status: 'OK',
            summary: 'Straight cable',
            connections: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            shorts: Array<number>(10).fill(0),
            id: 1,
            adapterType: 2,
          },
          '568B',
        );
      }
      await showResultNotification(
        'Pocketweb · Test notification',
        'Wiremap: Straight cable · ID 1\nLink: 1000 Mbps · Full duplex',
        image,
      );
      setMessage(
        'Test sent. Check your phone and watch; image display depends on your watch software.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send a test notification.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolPanel
      className="notification-settings"
      title="Result notifications"
      active={enabled}
      summary={enabled ? 'Notify after each measurement run' : 'Notifications are off'}
    >
      <p className="notification-description">
        Get a text summary after each measurement run, with an optional wiremap image.
      </p>
      {permission === 'unsupported' ? (
        <p>This browser does not support notifications here. Use Chrome over HTTPS.</p>
      ) : (
        <ToolAction
          label="Notifications"
          action={
            busy ? 'Please wait…' : enabled ? 'Disable notifications' : 'Enable notifications'
          }
          disabled={busy}
          onClick={() => {
            if (!enabled) {
              void enable();
              return;
            }
            try {
              const next = { ...preferences, enabled: false };
              saveNotificationPreferences(next);
              setPreferences(next);
              setMessage('Notifications disabled.');
            } catch {
              setMessage('Could not save notification preferences.');
            }
          }}
        />
      )}
      <ToolControl
        label="Include wiremap image"
        name="images"
        value={preferences.images ? 'on' : 'off'}
        options={[
          ['off', 'Off'],
          ['on', 'On'],
        ]}
        onChange={(_, value) => {
          try {
            const next = { ...preferences, images: value === 'on' };
            saveNotificationPreferences(next);
            setPreferences(next);
          } catch {
            setMessage('Could not save notification preferences.');
          }
        }}
      />
      <ToolAction
        label="Check watch delivery"
        action="Send test notification"
        disabled={!enabled || busy}
        onClick={() => void test()}
      />
      {message && (
        <p className="notification-message" role="status">
          {message}
        </p>
      )}
    </ToolPanel>
  );
}
