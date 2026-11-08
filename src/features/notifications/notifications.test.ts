import assert from 'node:assert/strict';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  showResultNotification,
} from './notifications';

const names = ['window', 'navigator', 'Notification', 'localStorage'] as const;
const original = names.map(
  (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);
const stored = new Map<string, string>();
const sent: { title: string; options: NotificationOptions & { image?: string } }[] = [];
let rejectImage = false;
let constructors = 0;
class AndroidNotification {
  static permission = 'granted';
  constructor() {
    constructors += 1;
    throw new Error('Android does not support the Notification constructor');
  }
}
const registration = {
  showNotification: (
    title: string,
    options: NotificationOptions & { image?: string },
  ): Promise<void> => {
    if (rejectImage && options.image) return Promise.reject(new Error('Image rejected'));
    sent.push({ title, options });
    return Promise.resolve();
  },
};
try {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true, Notification: AndroidNotification },
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: AndroidNotification,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: () => Promise.resolve(registration),
        ready: Promise.resolve(registration),
      },
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
  });
  assert.deepEqual(loadNotificationPreferences(), { enabled: false, images: true });
  stored.set('pockethernet.notifications', '{invalid');
  assert.equal(loadNotificationPreferences().enabled, false);
  saveNotificationPreferences({ enabled: true, images: false });
  assert.deepEqual(loadNotificationPreferences(), { enabled: true, images: false });

  await showResultNotification('Results', 'Wiremap: Straight', 'data:image/png;base64,test');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.image, 'data:image/png;base64,test');
  assert.equal(
    constructors,
    0,
    'Android must use the service worker, even with the app in the foreground',
  );
  rejectImage = true;
  await showResultNotification('Results', 'Wiremap: Open', 'data:image/png;base64,test');
  assert.equal(sent.length, 2);
  assert.equal(sent[1].options.body, 'Wiremap: Open');
  assert.equal(
    sent[1].options.image,
    undefined,
    'Text must still arrive when an image is rejected',
  );
  AndroidNotification.permission = 'denied';
  await assert.rejects(showResultNotification('Results', 'Wiremap: Open'), /Allow notifications/);
  assert.equal(sent.length, 2, 'Revoked permission must stop delivery');
  console.log('Notification permission and Android delivery tests passed.');
} finally {
  original.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
}
