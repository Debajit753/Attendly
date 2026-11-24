import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/** Hand a text file to the user: download on web, share sheet on the phone. Throws on failure. */
export async function shareTextFile(filename: string, text: string, mimeType = 'application/json'): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    return;
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
}
