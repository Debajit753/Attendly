// Web stub — background geofencing is native-only. Metro picks this on web.
export const GEOFENCE_TASK = 'bunksmart-geofence';
export async function enableGeofencing(_data: any): Promise<{ ok: boolean; reason?: string }> {
  return { ok: false, reason: 'unsupported' };
}
export async function disableGeofencing(): Promise<void> {}
export async function isGeofencingActive(): Promise<boolean> { return false; }
