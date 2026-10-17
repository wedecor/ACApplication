import * as ImagePicker from 'expo-image-picker';

export interface CapturedPhoto {
  uri: string;
  contentType: string;
}

/**
 * Open the camera (or the gallery as a fallback) and return a compressed
 * JPEG. Quality 0.6 keeps a typical photo well under the 10 MB upload cap
 * and fast on 3G.
 */
export async function capturePhoto(source: 'camera' | 'library' = 'camera'): Promise<CapturedPhoto | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission is needed to take job photos.'
        : 'Photo library permission is needed to attach photos.',
    );
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    exif: false,
    allowsEditing: false,
  };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  const mime = asset.mimeType?.toLowerCase();
  const contentType = mime && ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mime) ? mime : 'image/jpeg';
  return { uri: asset.uri, contentType };
}
