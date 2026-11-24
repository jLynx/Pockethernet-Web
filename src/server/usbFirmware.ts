export const USB_FIRMWARE_PREFIX = '/api/usb-firmware/';
export const USB_FIRMWARE_ORIGIN = 'https://pockethernet.com';
export const USB_FIRMWARE_ROUTE =
  /^\/api\/usb-firmware\/(manifest\.json|images\/[A-Za-z0-9][\w.-]*\.bin)$/;

export function usbFirmwareUpstream(path: string): string {
  return path.replace(USB_FIRMWARE_PREFIX, '/update/');
}

export async function serveUsbFirmware(request: Request, path: string): Promise<Response> {
  if (!USB_FIRMWARE_ROUTE.test(path)) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET')
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });

  const contentType = path.endsWith('/manifest.json')
    ? 'application/json'
    : 'application/octet-stream';
  try {
    const upstream = await fetch(USB_FIRMWARE_ORIGIN + usbFirmwareUpstream(path), {
      headers: { Accept: contentType },
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response('Unexpected redirect from the USB firmware server', { status: 502 });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Could not reach the USB firmware server', { status: 502 });
  }
}
