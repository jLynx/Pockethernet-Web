/// <reference types="w3c-web-serial" />
/// <reference types="w3c-web-usb" />

const USB_ID = { vendorId: 0x120b, productId: 0xc919 };
const USB_READ_DEPTH = 4;

export const SERIAL_BUFFER_SIZE = 65_536;
export type UpdaterPort = Pick<
  SerialPort,
  'open' | 'close' | 'getInfo' | 'setSignals' | 'readable' | 'writable'
>;

export function selectTransport(): 'serial' | 'usb' | undefined {
  if (navigator.usb && (/Android/i.test(navigator.userAgent) || !navigator.serial)) return 'usb';
  if (navigator.serial) return 'serial';
}

export async function requestPort(transport: 'serial' | 'usb'): Promise<UpdaterPort> {
  const port =
    transport === 'usb'
      ? new UsbSerialPort(await navigator.usb.requestDevice({ filters: [USB_ID] }))
      : await navigator.serial.requestPort({
          filters: [{ usbVendorId: USB_ID.vendorId, usbProductId: USB_ID.productId }],
        });
  const { usbVendorId, usbProductId } = port.getInfo();
  if (usbVendorId !== USB_ID.vendorId || usbProductId !== USB_ID.productId) {
    throw new Error('Select a Pockethernet 2 in the device picker.');
  }
  return port;
}

// Adapt USB CDC-ACM to the stream and line-control methods used by esptool-js.
class UsbSerialPort implements UpdaterPort {
  readable: SerialPort['readable'] = null;
  writable: SerialPort['writable'] = null;
  private controlInterface = 0;
  private lineState = 0;
  private stopReading?: () => void;

  constructor(private readonly device: USBDevice) {}

  getInfo(): SerialPortInfo {
    return { usbVendorId: this.device.vendorId, usbProductId: this.device.productId };
  }

  private async control(request: number, value: number, data?: Uint8Array<ArrayBuffer>) {
    const result = await this.device.controlTransferOut(
      {
        requestType: 'class',
        recipient: 'interface',
        request,
        value,
        index: this.controlInterface,
      },
      data,
    );
    if (result.status !== 'ok') throw new Error(`USB CDC control transfer ${result.status}.`);
  }

  async setBaudRate(baudRate: number): Promise<void> {
    const lineCoding = new Uint8Array(7);
    new DataView(lineCoding.buffer).setUint32(0, baudRate, true);
    lineCoding[6] = 8;
    await this.control(0x20, 0, lineCoding);
  }

  async setSignals({ dataTerminalReady, requestToSend }: SerialOutputSignals = {}): Promise<void> {
    const dtr = dataTerminalReady ?? Boolean(this.lineState & 1);
    const rts = requestToSend ?? Boolean(this.lineState & 2);
    this.lineState = Number(dtr) | (Number(rts) << 1);
    await this.control(0x22, this.lineState);
  }

  async open({ baudRate }: SerialOptions): Promise<void> {
    if (this.device.opened) throw new Error('The Pockethernet USB connection is already open.');
    await this.device.open();
    try {
      if (!this.device.configuration) await this.device.selectConfiguration(1);
      const interfaces = this.device.configuration?.interfaces ?? [];
      const control = interfaces.find((entry) => entry.alternate.interfaceClass === 2);
      const data = interfaces.find((entry) => entry.alternate.interfaceClass === 10);
      const input = data?.alternate.endpoints.find(
        (endpoint) => endpoint.type === 'bulk' && endpoint.direction === 'in',
      );
      const output = data?.alternate.endpoints.find(
        (endpoint) => endpoint.type === 'bulk' && endpoint.direction === 'out',
      );
      if (!data || !input || !output)
        throw new Error('Pockethernet USB serial endpoints are missing.');

      this.controlInterface = control?.interfaceNumber ?? data.interfaceNumber;
      if (control) await this.device.claimInterface(control.interfaceNumber);
      await this.device.claimInterface(data.interfaceNumber);
      await this.setBaudRate(baudRate);
      this.createStreams(input.endpointNumber, output.endpointNumber);
    } catch (error) {
      await this.close().catch(() => {});
      throw error;
    }
  }

  private createStreams(inputEndpoint: number, outputEndpoint: number) {
    const pending: Promise<USBInTransferResult>[] = [];
    let reading = true;
    this.stopReading = () => {
      reading = false;
      pending.length = 0;
    };
    const fillReads = () => {
      while (reading && pending.length < USB_READ_DEPTH) {
        const transfer = this.device.transferIn(inputEndpoint, 4096);
        // WebUSB rejects queued transfers when the device closes or disconnects.
        void transfer.catch(() => {});
        pending.push(transfer);
      }
    };
    this.readable = new ReadableStream({
      pull: async (controller) => {
        fillReads();
        while (reading) {
          const result = await pending.shift();
          if (!reading || !result) return;
          if (result.status === 'stall') {
            await this.device.clearHalt('in', inputEndpoint);
          } else if (result.status !== 'ok') {
            throw new Error(`USB read ${result.status}.`);
          } else if (result.data?.byteLength) {
            const { buffer, byteOffset, byteLength } = result.data;
            controller.enqueue(new Uint8Array(buffer, byteOffset, byteLength).slice());
            fillReads();
            return;
          }
          fillReads();
        }
      },
      cancel: this.stopReading,
    });
    this.writable = new WritableStream({
      write: async (data) => {
        const result = await this.device.transferOut(outputEndpoint, Uint8Array.from(data));
        if (result.status !== 'ok' || result.bytesWritten !== data.length) {
          throw new Error(`Incomplete USB write (${result.bytesWritten}/${data.length} bytes).`);
        }
      },
    });
  }

  async close(): Promise<void> {
    this.stopReading?.();
    this.stopReading = undefined;
    this.readable = null;
    this.writable = null;
    if (this.device.opened) await this.device.close();
  }
}
