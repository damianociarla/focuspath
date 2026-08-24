export function jpegDimensions(image: Uint8Array): { width: number; height: number } | null {
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (image[offset] === 0xff) offset += 1;
    const marker = image[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= image.length) break;

    const segmentLength = (image[offset]! << 8) | image[offset + 1]!;
    if (segmentLength < 2 || offset + segmentLength > image.length) break;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        width: (image[offset + 5]! << 8) | image[offset + 6]!,
        height: (image[offset + 3]! << 8) | image[offset + 4]!,
      };
    }
    offset += segmentLength;
  }

  return null;
}
