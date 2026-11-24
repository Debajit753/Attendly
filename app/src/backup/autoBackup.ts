import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppData, TODAY } from '../logic';
import { validateAppData, Checked } from '../cloud/validate';
import { backupFileName, backupJson, dayFromName, filesToPrune, isEmptyData } from './backupCore';

/* Automatic backups on the phone.
   1. Every day's latest copy goes to the app's private folder (newest 7 kept).
      Survives app updates, but not uninstalling.
   2. Optional (Android): a folder the user picks, e.g. Documents or Downloads. Written
      through the Storage Access Framework, so it survives uninstalling.
   The web build uses autoBackup.web.ts (no file system). */

export const autoBackupSupported = true;
export const folderSupported = Platform.OS === 'android';

const SAF = FileSystem.StorageAccessFramework;
const DIR = (FileSystem.documentDirectory ?? '') + 'backups/';
const FOLDER_KEY = 'attendly:backup:folder';
const STATUS_KEY = 'attendly:backup:status';

export type BackupStatus = { lastAt?: string; folderError?: string };
export type BackupEntry = { day: string; uri: string; where: 'phone' | 'folder' };

export async function getStatus(): Promise<BackupStatus> {
  try { return JSON.parse((await AsyncStorage.getItem(STATUS_KEY)) ?? '{}'); } catch { return {}; }
}
async function setStatus(s: BackupStatus) { try { await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export async function getFolder(): Promise<string | null> {
  try { return await AsyncStorage.getItem(FOLDER_KEY); } catch { return null; }
}
/** Readable folder name from a SAF tree URI (".../tree/primary%3ADocuments%2FAttendly" -> "Documents/Attendly"). */
export function folderLabel(uri: string): string {
  const tail = decodeURIComponent(uri.split('/tree/')[1] ?? uri);
  return tail.replace(/^primary:/, '') || 'chosen folder';
}

const safName = (uri: string) => decodeURIComponent(uri).split('/').pop() ?? '';

async function writeToFolder(dirUri: string, json: string) {
  const files = await SAF.readDirectoryAsync(dirUri);
  const today = files.find(u => dayFromName(safName(u)) === TODAY);
  const target = today ?? await SAF.createFileAsync(dirUri, backupFileName(TODAY).replace(/\.json$/, ''), 'application/json');
  await FileSystem.writeAsStringAsync(target, json);
  const all = today ? files : [...files, target];
  for (const name of filesToPrune(all.map(safName))) {
    const uri = all.find(u => safName(u) === name);
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

/** Write today's backup (overwriting earlier ones from today) and prune old days.
    Empty data is never backed up, so an Erase can't overwrite the good copies. */
export async function writeAutoBackup(data: AppData): Promise<BackupStatus> {
  if (!FileSystem.documentDirectory || isEmptyData(data)) return getStatus();
  const json = backupJson(data);
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(DIR + backupFileName(TODAY), json);
  for (const name of filesToPrune(await FileSystem.readDirectoryAsync(DIR))) {
    await FileSystem.deleteAsync(DIR + name, { idempotent: true });
  }
  const status: BackupStatus = { lastAt: new Date().toISOString() };
  const folder = folderSupported ? await getFolder() : null;
  if (folder) {
    try { await writeToFolder(folder, json); }
    catch { status.folderError = "Couldn't write to the backup folder. Choose it again."; }
  }
  await setStatus(status);
  return status;
}

/** Let the user pick a folder (Android). Returns its label, or null if cancelled. */
export async function chooseFolder(data: AppData): Promise<string | null> {
  if (!folderSupported) return null;
  const res = await SAF.requestDirectoryPermissionsAsync();
  if (!res.granted) return null;
  await AsyncStorage.setItem(FOLDER_KEY, res.directoryUri);
  await writeAutoBackup(data);
  return folderLabel(res.directoryUri);
}

export async function stopFolder(): Promise<void> {
  await AsyncStorage.removeItem(FOLDER_KEY);
  const s = await getStatus();
  delete s.folderError;
  await setStatus(s);
}

/** Every automatic backup available, newest first (private folder and backup folder). */
export async function listBackups(): Promise<BackupEntry[]> {
  const out: BackupEntry[] = [];
  try {
    for (const name of await FileSystem.readDirectoryAsync(DIR)) {
      const day = dayFromName(name);
      if (day) out.push({ day, uri: DIR + name, where: 'phone' });
    }
  } catch { /* no backups yet */ }
  const folder = folderSupported ? await getFolder() : null;
  if (folder) {
    try {
      for (const uri of await SAF.readDirectoryAsync(folder)) {
        const day = dayFromName(safName(uri));
        if (day) out.push({ day, uri, where: 'folder' });
      }
    } catch { /* folder no longer reachable */ }
  }
  return out.sort((a, b) => b.day.localeCompare(a.day) || a.where.localeCompare(b.where));
}

/** Read and check one backup before offering to restore it. */
export async function readBackup(uri: string): Promise<Checked> {
  try {
    return validateAppData(JSON.parse(await FileSystem.readAsStringAsync(uri)));
  } catch {
    return { ok: false, error: "This backup file couldn't be read." };
  }
}
