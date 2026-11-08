export interface NotificationPreferences {
  enabled: boolean;
  images: boolean;
}

const KEY = 'pockethernet.notifications';

export function loadNotificationPreferences(): NotificationPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof saved === 'object' && saved !== null) {
      return {
        enabled: 'enabled' in saved && saved.enabled === true,
        images: !('images' in saved) || saved.images !== false,
      };
    }
  } catch {
    // Notifications remain optional when browser storage is unavailable.
  }
  return { enabled: false, images: true };
}

export function saveNotificationPreferences(preferences: NotificationPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(preferences));
}

export function notificationsSupported(): boolean {
  return window.isSecureContext && 'Notification' in window;
}

export async function showResultNotification(
  title: string,
  body: string,
  image?: string,
): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') {
    throw new Error('Allow notifications in your browser’s site settings first.');
  }
  const options: NotificationOptions & { image?: string } = {
    body,
    icon: '/logo-192.png',
    ...(image ? { image } : {}),
  };
  // Persistent service-worker notifications work on Android, where the
  // Notification constructor is unsupported. Do not wait forever in dev mode.
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Notifications are starting. Try again shortly.')),
            5000,
          );
        }),
      ]);
      try {
        await ready.showNotification(title, options);
      } catch (error) {
        if (!image) throw error;
        await ready.showNotification(title, { body, icon: options.icon });
      }
      return;
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      window.postMessage({ type: 'pocketweb-open-results' }, window.location.origin);
      notification.close();
    };
  } catch {
    throw new Error(
      'Open the installed app or production site to use notifications on this browser.',
    );
  }
}
