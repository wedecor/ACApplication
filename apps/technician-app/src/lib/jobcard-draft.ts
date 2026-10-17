/**
 * Local autosave for the job-card form. Every edit lands here immediately
 * (so a crash / app kill never loses on-site notes), and `synced` flips to
 * true once the server (or the offline queue) has the same content.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { JobCardForm } from './jobcard-logic';
import type { JobCardResponse } from './repair-types';

const key = (bookingId: string) => `ac.tech.jobcardDraft.${bookingId}`;

export interface JobCardDraft {
  form: JobCardForm;
  savedAt: string;
  /** False while the latest edits only exist on this device. */
  synced: boolean;
}

export async function loadJobCardDraft(bookingId: string): Promise<JobCardDraft | null> {
  const raw = await AsyncStorage.getItem(key(bookingId)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobCardDraft;
  } catch {
    return null;
  }
}

export async function saveJobCardDraft(
  bookingId: string,
  form: JobCardForm,
  synced: boolean,
): Promise<void> {
  const draft: JobCardDraft = { form, savedAt: new Date().toISOString(), synced };
  await AsyncStorage.setItem(key(bookingId), JSON.stringify(draft)).catch(() => undefined);
}

export async function clearJobCardDraft(bookingId: string): Promise<void> {
  await AsyncStorage.removeItem(key(bookingId)).catch(() => undefined);
}

const snapshotKey = (bookingId: string) => `ac.tech.jobcardSnapshot.${bookingId}`;

/**
 * Last good server response (job card + templates) so the checklist can
 * still render when the technician opens the job with no signal.
 */
export async function saveJobCardSnapshot(bookingId: string, data: JobCardResponse): Promise<void> {
  await AsyncStorage.setItem(snapshotKey(bookingId), JSON.stringify(data)).catch(() => undefined);
}

export async function loadJobCardSnapshot(bookingId: string): Promise<JobCardResponse | null> {
  const raw = await AsyncStorage.getItem(snapshotKey(bookingId)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobCardResponse;
  } catch {
    return null;
  }
}
