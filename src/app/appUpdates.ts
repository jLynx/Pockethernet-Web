export interface AppUpdateWorker extends EventTarget {
  readonly state: ServiceWorkerState;
  postMessage(message: { type: 'SKIP_WAITING' }): void;
}

interface AppUpdateRegistration extends EventTarget {
  readonly installing: AppUpdateWorker | null;
  readonly waiting: AppUpdateWorker | null;
  update(): Promise<unknown>;
}

interface AppUpdateEnvironment {
  serviceWorkers: EventTarget & {
    readonly controller: unknown;
    register(url: string): Promise<AppUpdateRegistration>;
  };
  page: EventTarget & { readonly hidden: boolean; readonly readyState: string };
  host: EventTarget & {
    setInterval(callback: () => void, milliseconds: number): number;
    clearInterval(id: number): void;
  };
  isOnline: () => boolean;
  reload: () => void;
}

/** Download updates in the background; activate and reload only on an explicit request. */
export function monitorAppUpdates(options: {
  environment: AppUpdateEnvironment;
  scriptUrl: string;
  onWaiting: (worker: AppUpdateWorker) => void;
  onError: (error: unknown) => void;
}): { applyUpdate: (worker: AppUpdateWorker) => boolean; dispose: () => void } {
  const { serviceWorkers, page, host, isOnline, reload } = options.environment;
  let active = true;
  let updateRequested = false;
  let cleanupRegistration = () => {};
  const onControllerChange = () => {
    if (active && updateRequested) reload();
  };
  serviceWorkers.addEventListener('controllerchange', onControllerChange);

  const register = async () => {
    try {
      const registration = await serviceWorkers.register(options.scriptUrl);
      if (!active) return;

      let installing: AppUpdateWorker | null = null;
      let offered: AppUpdateWorker | null = null;
      const offerUpdate = (worker: AppUpdateWorker | null) => {
        if (active && worker && serviceWorkers.controller && worker !== offered) {
          offered = worker;
          options.onWaiting(worker);
        }
      };
      const onStateChange = () => {
        if (installing?.state === 'installed') offerUpdate(registration.waiting ?? installing);
      };
      const onUpdateFound = () => {
        installing?.removeEventListener('statechange', onStateChange);
        installing = registration.installing;
        installing?.addEventListener('statechange', onStateChange);
        onStateChange();
      };
      let checking = false;
      const checkForUpdate = () => {
        if (!active || !isOnline() || checking) return;
        checking = true;
        void registration
          .update()
          .catch(() => {})
          .finally(() => {
            checking = false;
          });
      };
      const onVisibilityChange = () => {
        if (!page.hidden) checkForUpdate();
      };

      offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', onUpdateFound);
      if (registration.installing) onUpdateFound();
      page.addEventListener('visibilitychange', onVisibilityChange);
      host.addEventListener('online', checkForUpdate);
      const interval = host.setInterval(checkForUpdate, 60 * 60 * 1000);
      cleanupRegistration = () => {
        registration.removeEventListener('updatefound', onUpdateFound);
        installing?.removeEventListener('statechange', onStateChange);
        page.removeEventListener('visibilitychange', onVisibilityChange);
        host.removeEventListener('online', checkForUpdate);
        host.clearInterval(interval);
      };
      checkForUpdate();
    } catch (error) {
      if (active) options.onError(error);
    }
  };
  const onLoad = () => {
    void register();
  };
  if (page.readyState === 'complete') onLoad();
  else host.addEventListener('load', onLoad, { once: true });

  return {
    applyUpdate(worker) {
      if (!active || worker.state !== 'installed') return false;
      updateRequested = true;
      try {
        worker.postMessage({ type: 'SKIP_WAITING' });
        return true;
      } catch (error) {
        updateRequested = false;
        options.onError(error);
        return false;
      }
    },
    dispose() {
      active = false;
      host.removeEventListener('load', onLoad);
      serviceWorkers.removeEventListener('controllerchange', onControllerChange);
      cleanupRegistration();
    },
  };
}
