import { PACKET, type Packet } from '@/pockethernetProtocol';

export class DeviceTimeoutError extends Error {
  constructor() {
    super('The device did not respond in time');
  }
}
export class DeviceRejectedError extends Error {
  constructor() {
    super('Device rejected the request');
  }
}

export interface PacketWaitOptions {
  signal?: AbortSignal;
  accept?: (packet: Packet) => boolean;
  /** Passive notifications must not consume a NACK for a command awaiting ACK. */
  rejectNack?: boolean;
  /** Capture immediately, but start the deadline after configuration/link setup. */
  startAfter?: Promise<void>;
}

interface Pending {
  packet: (packet: Packet) => void;
  stop: (error: Error) => void;
}

export interface PacketInbox {
  readonly busy: boolean;
  receive: (packet: Packet) => void;
  cancel: (error?: Error) => void;
  waitFor: (
    types: number | number[],
    timeout?: number,
    options?: PacketWaitOptions,
  ) => Promise<Packet>;
  collectFor: (type: number, timeout?: number, options?: PacketWaitOptions) => Promise<Packet[]>;
}

/** One connection's reply listeners. Cancel scopes before starting another run. */
export function createPacketInbox(): PacketInbox {
  const pending = new Set<Pending>();

  function listen<T>(
    timeout: number,
    options: PacketWaitOptions,
    onPacket: (
      packet: Packet,
      resolve: (result: T) => void,
      reject: (error: Error) => void,
    ) => void,
    onTimeout: (resolve: (result: T) => void, reject: (error: Error) => void) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let finished = false;
      const finish = (): boolean => {
        if (finished) return false;
        finished = true;
        clearTimeout(timer);
        pending.delete(listener);
        options.signal?.removeEventListener('abort', abort);
        return true;
      };
      const ok = (result: T): void => {
        if (finish()) resolve(result);
      };
      const fail = (error: Error): void => {
        if (finish()) reject(error);
      };
      const abort = (): void => fail(new Error('Packet wait cancelled'));
      const listener: Pending = { packet: (packet) => onPacket(packet, ok, fail), stop: fail };
      if (options.signal?.aborted) {
        abort();
        return;
      }
      pending.add(listener);
      options.signal?.addEventListener('abort', abort, { once: true });
      const startTimer = (): void => {
        if (!finished) timer = setTimeout(() => onTimeout(ok, fail), timeout);
      };
      if (options.startAfter) void options.startAfter.then(startTimer, fail);
      else startTimer();
    });
  }

  return {
    get busy(): boolean {
      return pending.size > 0;
    },
    receive(packet: Packet): void {
      // Deliver to collectors and matching passive listeners as well as the command waiter.
      for (const listener of [...pending]) listener.packet(packet);
    },
    cancel(error = new Error('Pockethernet disconnected')): void {
      for (const listener of [...pending]) listener.stop(error);
    },
    waitFor(
      types: number | number[],
      timeout = 5000,
      options: PacketWaitOptions = {},
    ): Promise<Packet> {
      const expected = Array.isArray(types) ? types : [types];
      return listen<Packet>(
        timeout,
        options,
        (packet, resolve, reject) => {
          if (packet.type === PACKET.NACK && options.rejectNack !== false)
            reject(new DeviceRejectedError());
          else if (expected.includes(packet.type) && (!options.accept || options.accept(packet)))
            resolve(packet);
        },
        (_resolve, reject) => reject(new DeviceTimeoutError()),
      );
    },
    collectFor(type: number, timeout = 5000, options: PacketWaitOptions = {}): Promise<Packet[]> {
      const packets: Packet[] = [];
      return listen<Packet[]>(
        timeout,
        options,
        (packet) => {
          if (packet.type === type && (!options.accept || options.accept(packet)))
            packets.push(packet);
        },
        (resolve) => resolve(packets),
      );
    },
  };
}

export async function requestPacket(
  inbox: ReturnType<typeof createPacketInbox>,
  send: (command: Packet) => Promise<void>,
  command: Packet,
  types: number | number[],
  timeout = 5000,
  options: PacketWaitOptions = {},
): Promise<Packet> {
  const scope = new AbortController();
  const abort = (): void => scope.abort();
  if (options.signal?.aborted) scope.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const reply = inbox.waitFor(types, timeout, { ...options, signal: scope.signal });
  // Attach immediately: timeout/NACK may arrive while the chunked write is still pending.
  void reply.catch(() => undefined);
  try {
    if (scope.signal.aborted) throw new Error('Packet wait cancelled');
    await send(command);
    return await reply;
  } finally {
    scope.abort();
    options.signal?.removeEventListener('abort', abort);
  }
}
