import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ESPLoader, Transport } from 'esptool-js';
import { PACKET } from '@/protocol/constants';
import { describeError, STM_HEADER_SIZE } from './firmware';
import type { FirmwareImages } from './firmware';
import { SERIAL_BUFFER_SIZE } from './serial';
import type { UpdaterPort } from './serial';
import { BOOTLOADER_BAUD, delay, withSerial } from './usbProtocol';

const BOOTLOADER = {
  identify: 0xf004,
  stmHeader: 0xf012,
  stmBlock: 0xf013,
  enterEspLoader: 0xf020,
  restart: 0xf030,
  usbMode: 0xff000003,
};
const STM_BLOCK_SIZE = 1024;
const ESP_PROGRESS_SHARE = 0.88;

const ESP_BAUD_RATES = { fast: 888_889, backup: 231_884 };
export type UpdateMode = keyof typeof ESP_BAUD_RATES;

interface UpdateCallbacks {
  onStage: (message: string) => void;
  onProgress: (fraction: number) => void;
  onWriteStarting?: () => void;
  log: (message: string) => void;
}

async function returnToStmBootloader(port: UpdaterPort) {
  // Opening at this baud switches the Pockethernet USB bridge back to the STM bootloader.
  await withSerial(port, 576_000, (connection) => connection.drain(300));
  await delay(300);
}

async function checkBootloader(port: UpdaterPort, log: UpdateCallbacks['log']) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let heardFromDevice = false;
    const reply = await withSerial(port, BOOTLOADER_BAUD, async (connection) => {
      await connection.send(BOOTLOADER.identify);
      return connection.readMatching((packet) => {
        heardFromDevice = true;
        return packet.type === PACKET.DEVICE_INFO && packet.payload.length >= 24;
      }, 600);
    });
    if (reply) {
      const { buffer, byteOffset, byteLength } = reply.payload;
      const info = new DataView(buffer, byteOffset, byteLength);
      return info.getUint32(8, true) === BOOTLOADER.usbMode;
    }
    if (heardFromDevice || attempt === 2) return false;
    log('No bootloader response. Resetting the USB bridge and trying again.');
    await returnToStmBootloader(port);
  }
  return false;
}

async function flashEsp(
  port: UpdaterPort,
  images: FirmwareImages['esp'],
  mode: UpdateMode,
  { onProgress, log }: UpdateCallbacks,
) {
  await withSerial(port, BOOTLOADER_BAUD, async (connection) => {
    await connection.send(BOOTLOADER.enterEspLoader);
    await connection.drain(1000);
  });
  await delay(300);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Transport uses only the SerialPort methods provided by the USB CDC adapter.
  const transport = new Transport(port as SerialPort);
  const loader = new ESPLoader({
    transport,
    baudrate: ESP_BAUD_RATES[mode],
    romBaudrate: BOOTLOADER_BAUD,
    serialOptions: { bufferSize: SERIAL_BUFFER_SIZE },
    terminal: { clean() {}, writeLine: log, write: log },
  });
  const total = images.reduce((bytes, image) => bytes + image.data.length, 0);
  try {
    await loader.main('no_reset');
    await loader.writeFlash({
      fileArray: images,
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      compress: true,
      eraseAll: false,
      calculateMD5Hash: (data) => bytesToHex(md5(data)),
      reportProgress: (index, written) => {
        const previous = index === 0 ? 0 : images[0].data.length;
        onProgress((ESP_PROGRESS_SHARE * (previous + written)) / total);
      },
    });
    await loader.after('no_reset');
    onProgress(ESP_PROGRESS_SHARE);
  } finally {
    await transport.disconnect().catch(() => {});
  }
}

async function flashStm(
  port: UpdaterPort,
  image: FirmwareImages['stm'],
  { onProgress, log }: UpdateCallbacks,
) {
  await withSerial(port, BOOTLOADER_BAUD, async (connection) => {
    const awaitAck = async (stage: string, timeout: number) => {
      const reply = await connection.readMatching(
        ({ type }) => type === PACKET.ACK || type === PACKET.NACK,
        timeout,
      );
      if (!reply) throw new Error(`The STM did not acknowledge ${stage}.`);
      if (reply.type === PACKET.NACK) throw new Error(`The STM rejected ${stage}.`);
    };

    await connection.send(BOOTLOADER.stmHeader, image.subarray(0, STM_HEADER_SIZE), true);
    await awaitAck('the image header', 10_000);
    log('STM accepted the firmware header.');

    const body = image.subarray(STM_HEADER_SIZE);
    for (let offset = 0; offset < body.length; offset += STM_BLOCK_SIZE) {
      const block = body.subarray(offset, offset + STM_BLOCK_SIZE);
      await connection.send(BOOTLOADER.stmBlock, block, true);
      await awaitAck(`block ${offset / STM_BLOCK_SIZE + 1}`, 2000);
      const fraction = (offset + block.length) / body.length;
      onProgress(ESP_PROGRESS_SHARE + fraction * (1 - ESP_PROGRESS_SHARE));
    }
    log(`STM acknowledged all ${body.length} firmware bytes.`);
    await connection.send(BOOTLOADER.restart, undefined, true);
    await delay(200);
  });
}

export async function updateDevice(
  port: UpdaterPort,
  images: FirmwareImages,
  mode: UpdateMode,
  callbacks: UpdateCallbacks,
): Promise<void> {
  const { log, onStage } = callbacks;
  onStage('Checking USB update mode…');
  if (!(await checkBootloader(port, log))) {
    throw new Error('Switch the tester off, unplug the USB cable, and plug it back in.');
  }

  callbacks.onWriteStarting?.();
  onStage('Updating ESP firmware…');
  try {
    await flashEsp(port, images.esp, mode, callbacks);
  } catch (error) {
    log(`ESP update attempt failed: ${describeError(error)}`);
    await returnToStmBootloader(port);
    onStage('Retrying ESP firmware…');
    await flashEsp(port, images.esp, mode, callbacks);
  }
  await returnToStmBootloader(port);

  onStage('Updating STM firmware…');
  await flashStm(port, images.stm, callbacks);
}
