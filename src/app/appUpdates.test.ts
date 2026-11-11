import assert from 'node:assert/strict';
import { monitorAppUpdates, type AppUpdateWorker } from './appUpdates';

class Worker extends EventTarget implements AppUpdateWorker {
  state: ServiceWorkerState = 'installing';
  messages: { type: 'SKIP_WAITING' }[] = [];
  fail = false;
  postMessage(message: { type: 'SKIP_WAITING' }): void {
    if (this.fail) throw new Error('Worker unavailable');
    this.messages.push(message);
  }
  install(): void {
    this.state = 'installed';
    this.dispatchEvent(new Event('statechange'));
  }
}

class Registration extends EventTarget {
  installing: Worker | null = null;
  waiting: Worker | null = null;
  checks = 0;
  failCheck = false;
  update(): Promise<void> {
    this.checks += 1;
    return this.failCheck ? Promise.reject(new Error('Offline')) : Promise.resolve();
  }
}

class ServiceWorkers extends EventTarget {
  controller: Worker | null = new Worker();
  registration = new Registration();
  urls: string[] = [];
  registerResult: Promise<Registration> | null = null;
  register(url: string): Promise<Registration> {
    this.urls.push(url);
    return this.registerResult ?? Promise.resolve(this.registration);
  }
}

class Page extends EventTarget {
  hidden = false;
  readyState = 'complete';
}

class Host extends EventTarget {
  intervals = new Map<number, () => void>();
  delays: number[] = [];
  setInterval(callback: () => void, milliseconds: number): number {
    this.delays.push(milliseconds);
    this.intervals.set(this.delays.length, callback);
    return this.delays.length;
  }
  clearInterval(id: number): void {
    this.intervals.delete(id);
  }
}

function setup() {
  const serviceWorkers = new ServiceWorkers();
  const page = new Page();
  const host = new Host();
  const state = { online: true, reloads: 0 };
  const waiting: AppUpdateWorker[] = [];
  const errors: unknown[] = [];
  const start = () =>
    monitorAppUpdates({
      environment: {
        serviceWorkers,
        page,
        host,
        isOnline: () => state.online,
        reload: () => {
          state.reloads += 1;
        },
      },
      scriptUrl: '/sw.js',
      onWaiting: (worker) => waiting.push(worker),
      onError: (error) => errors.push(error),
    });
  return { serviceWorkers, page, host, state, waiting, errors, start };
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

// A first install enables offline support without offering an update or reloading.
{
  const fixture = setup();
  fixture.serviceWorkers.controller = null;
  const monitor = fixture.start();
  await settle();
  const worker = new Worker();
  fixture.serviceWorkers.registration.installing = worker;
  fixture.serviceWorkers.registration.dispatchEvent(new Event('updatefound'));
  worker.install();
  fixture.serviceWorkers.dispatchEvent(new Event('controllerchange'));
  assert.equal(fixture.waiting.length, 0);
  assert.equal(fixture.state.reloads, 0);
  monitor.dispose();
}

// No-change checks, dismissing a ready update, and another tab activating do not reload.
{
  const fixture = setup();
  const monitor = fixture.start();
  await settle();
  assert.deepEqual(fixture.serviceWorkers.urls, ['/sw.js']);
  assert.equal(fixture.serviceWorkers.registration.checks, 1);
  assert.equal(fixture.waiting.length, 0);
  const worker = new Worker();
  fixture.serviceWorkers.registration.installing = worker;
  fixture.serviceWorkers.registration.dispatchEvent(new Event('updatefound'));
  assert.equal(monitor.applyUpdate(worker), false, 'Do not activate an incomplete download');
  worker.install();
  worker.dispatchEvent(new Event('statechange'));
  assert.deepEqual(fixture.waiting, [worker], 'Offer an installed version only once');
  assert.deepEqual(worker.messages, [], 'An offered update remains waiting until requested');
  fixture.serviceWorkers.dispatchEvent(new Event('controllerchange'));
  assert.equal(fixture.state.reloads, 0);
  assert.equal(monitor.applyUpdate(worker), true);
  assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(fixture.state.reloads, 0, 'Wait for activation before reloading');
  fixture.serviceWorkers.dispatchEvent(new Event('controllerchange'));
  assert.equal(fixture.state.reloads, 1);
  monitor.dispose();
  fixture.serviceWorkers.dispatchEvent(new Event('controllerchange'));
  assert.equal(fixture.state.reloads, 1, 'Remove the reload listener on cleanup');
}

// Discover updates already waiting at startup and check foreground, online, and hourly events.
{
  const fixture = setup();
  const worker = new Worker();
  worker.install();
  fixture.serviceWorkers.registration.waiting = worker;
  const monitor = fixture.start();
  await settle();
  assert.deepEqual(fixture.waiting, [worker]);
  assert.deepEqual(fixture.host.delays, [60 * 60 * 1000]);
  fixture.page.hidden = true;
  fixture.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(fixture.serviceWorkers.registration.checks, 1);
  fixture.page.hidden = false;
  fixture.page.dispatchEvent(new Event('visibilitychange'));
  await settle();
  assert.equal(fixture.serviceWorkers.registration.checks, 2);
  fixture.state.online = false;
  fixture.host.dispatchEvent(new Event('online'));
  for (const callback of fixture.host.intervals.values()) callback();
  assert.equal(fixture.serviceWorkers.registration.checks, 2);
  fixture.state.online = true;
  fixture.host.dispatchEvent(new Event('online'));
  await settle();
  assert.equal(fixture.serviceWorkers.registration.checks, 3);
  fixture.serviceWorkers.registration.failCheck = true;
  for (const callback of fixture.host.intervals.values()) callback();
  await settle();
  assert.equal(fixture.serviceWorkers.registration.checks, 4);
  assert.equal(fixture.state.reloads, 0, 'Failed update checks must keep the page running');
  worker.fail = true;
  assert.equal(monitor.applyUpdate(worker), false);
  fixture.serviceWorkers.dispatchEvent(new Event('controllerchange'));
  assert.equal(fixture.state.reloads, 0, 'Failed activation must not reload');
  assert.equal(fixture.errors.length, 1);
  monitor.dispose();
  fixture.page.dispatchEvent(new Event('visibilitychange'));
  fixture.host.dispatchEvent(new Event('online'));
  assert.equal(fixture.host.intervals.size, 0);
  assert.equal(fixture.serviceWorkers.registration.checks, 4);
}

// StrictMode cleanup while registration is pending leaves no stale timers or callbacks.
{
  const fixture = setup();
  let resolveRegistration: (registration: Registration) => void = () => {};
  fixture.serviceWorkers.registerResult = new Promise((resolve) => {
    resolveRegistration = resolve;
  });
  const monitor = fixture.start();
  monitor.dispose();
  resolveRegistration(fixture.serviceWorkers.registration);
  await settle();
  assert.equal(fixture.host.intervals.size, 0);
  assert.equal(fixture.serviceWorkers.registration.checks, 0);
  assert.equal(fixture.waiting.length, 0);
}

// Defer registration until load; handle registration failure without a reload.
{
  const fixture = setup();
  fixture.page.readyState = 'loading';
  const monitor = fixture.start();
  assert.equal(fixture.serviceWorkers.urls.length, 0);
  fixture.serviceWorkers.registerResult = Promise.reject(new Error('Registration failed'));
  fixture.host.dispatchEvent(new Event('load'));
  await settle();
  assert.equal(fixture.errors.length, 1);
  assert.equal(fixture.state.reloads, 0);
  monitor.dispose();
}

console.log('App update checks, explicit activation, offline handling, and cleanup tests passed.');
