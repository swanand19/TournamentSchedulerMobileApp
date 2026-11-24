import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getApiBaseUrl } from '@/api/client';

// Pictures (HLD P-26): profile photos, a tournament's logo and banner.
//
// Putting one in: the person picks a photo, the phone crops it to its shape and shrinks it (a photo
// 512 px square, a banner 1280 × 720), and re-saves it as JPEG — which also drops the photo's
// location data — before it goes, sealed like every other request, through api.call.
//
// Showing one: answers carry a signed link that lasts a day or two, relative to the API
// ("pictures/<id>?e=…&s=…"); the image loads it straight from the server, outside the gateway.

export type PictureShape = 'square' | 'banner';

const SHAPES: Record<PictureShape, { aspect: [number, number]; width: number }> = {
  square: { aspect: [1, 1], width: 512 },
  banner: { aspect: [16, 9], width: 1280 },
};

/** The address an image loads a picture link from, or null when there's no picture. */
export function pictureUri(link: string | null | undefined): string | null {
  if (!link) return null;
  const base = getApiBaseUrl();
  return base ? `${base}/api/${link}` : null;
}

/**
 * Lets the person pick a photo and readies it for upload: cropped to the shape (the system editor on
 * Android keeps the shape; iOS's is always square, so the crop here makes sure), shrunk, JPEG. Answers
 * the base64, or null when they cancelled.
 */
export async function pickPicture(shape: PictureShape): Promise<string | null> {
  const { aspect, width: maxWidth } = SHAPES[shape];
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1 });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  let width = asset.width;
  if (asset.width > 0 && asset.height > 0) {
    // The largest centred rectangle of the right shape.
    const ratio = aspect[0] / aspect[1];
    const cropWidth = Math.min(asset.width, Math.round(asset.height * ratio));
    const cropHeight = Math.round(cropWidth / ratio);
    context.crop({
      originX: Math.floor((asset.width - cropWidth) / 2),
      originY: Math.floor((asset.height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    });
    width = cropWidth;
  }
  // Never enlarged: a small photo stays small.
  if (!width || width > maxWidth) context.resize({ width: maxWidth });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return saved.base64 ?? null;
}
