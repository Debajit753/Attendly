import { AppData } from '../logic';
import type { Checked } from '../cloud/validate';

/* Web build: browsers have no app file system, so automatic backups only run in the
   phone app. "Create backup" (download) still works on the web. */

export const autoBackupSupported = false;
export const folderSupported = false;
export type BackupStatus = { lastAt?: string; folderError?: string };
export type BackupEntry = { day: string; uri: string; where: 'phone' | 'folder' };

export const getStatus = async (): Promise<BackupStatus> => ({});
export const getFolder = async (): Promise<string | null> => null;
export const folderLabel = (uri: string) => uri;
export const writeAutoBackup = async (_d: AppData): Promise<BackupStatus> => ({});
export const chooseFolder = async (_d: AppData): Promise<string | null> => null;
export const stopFolder = async (): Promise<void> => {};
export const listBackups = async (): Promise<BackupEntry[]> => [];
export const readBackup = async (_uri: string): Promise<Checked> => ({ ok: false, error: 'Not available on the web.' });
