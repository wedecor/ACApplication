import * as ImagePicker from 'expo-image-picker';

import { uploadApi } from '@/api/endpoints';

/**
 * Pick a photo from the camera or library and upload it via a
 * presigned URL. Returns the public URL on success.
 *
 * Why presigned? The mobile app must never see S3 credentials, and
 * direct uploads avoid hauling binary blobs through the API. The
 * backend issues a one-shot, short-lived URL scoped to the
 * customer's tenant + media bucket.
 */
export interface PickedImage {
  uri: string;
  publicUrl: string;
}

export async function pickAndUploadImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsMultipleSelection: false,
        });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const filename = asset.fileName ?? `photo-${Date.now()}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';

  const { uploadUrl, publicUrl } = await uploadApi.presign({ filename, contentType });
  const fetchResp = await fetch(asset.uri);
  const blob = await fetchResp.blob();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status})`);
  }
  return { uri: asset.uri, publicUrl };
}
