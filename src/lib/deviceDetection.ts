import { supabase } from '@/integrations/supabase/client';

interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  browser: string;
  os: string;
}

const getBrowser = (ua: string): string => {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Navegador desconhecido';
};

const getOS = (ua: string): string => {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'SO desconhecido';
};

const getDeviceName = (ua: string): string => {
  const os = getOS(ua);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const type = isMobile ? 'Celular/Tablet' : 'Computador';
  return `${type} — ${os}`;
};

export const getDeviceFingerprint = (): string => {
  const ua = navigator.userAgent;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const colorDepth = String(window.screen.colorDepth);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language;
  const platform = navigator.platform || '';

  const raw = `${ua}|${screen}|${colorDepth}|${timezone}|${lang}|${platform}`;

  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

export const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  return {
    fingerprint: getDeviceFingerprint(),
    deviceName: getDeviceName(ua),
    browser: getBrowser(ua),
    os: getOS(ua),
  };
};

export interface DeviceCheckResult {
  isNewDevice: boolean;
  deviceInfo: DeviceInfo;
}

const APP_VERSION =
  (import.meta as any).env?.VITE_APP_VERSION ||
  (import.meta as any).env?.VITE_COMMIT_SHA ||
  'web';

// Best-effort captura de IP + geolocalização aproximada (não bloqueia login).
const fetchGeoInfo = async (): Promise<{ ip?: string; country?: string; city?: string }> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return {};
    const j = await res.json();
    return { ip: j.ip, country: j.country_name || j.country, city: j.city };
  } catch {
    return {};
  }
};

export const checkAndRegisterDevice = async (userId: string): Promise<DeviceCheckResult> => {
  const deviceInfo = getDeviceInfo();
  const geo = await fetchGeoInfo();

  const meta = {
    ip_address: geo.ip ?? null,
    geo_country: geo.country ?? null,
    geo_city: geo.city ?? null,
    app_version: APP_VERSION,
  };

  // Check if this device is already known
  const { data: existing } = await supabase
    .from('user_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceInfo.fingerprint)
    .maybeSingle();

  if (existing) {
    // Known device - update last login + metadata mais recente
    await supabase
      .from('user_devices')
      .update({ last_login_at: new Date().toISOString(), ...meta })
      .eq('id', existing.id);

    return { isNewDevice: false, deviceInfo };
  }

  // New device - register it
  await supabase
    .from('user_devices')
    .insert({
      user_id: userId,
      device_fingerprint: deviceInfo.fingerprint,
      device_name: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ...meta,
    });

  return { isNewDevice: true, deviceInfo };
};
