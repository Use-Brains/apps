export async function resizeImage(file, maxDimension = 1568, quality = 1.0) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close(); // free memory immediately

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

  // iOS Safari: explicitly release canvas memory
  canvas.width = 1;
  canvas.height = 1;

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

// Process multiple images sequentially (NOT in parallel) — iOS Safari crashes with parallel canvas ops
export async function resizeImages(files, maxDimension = 1568) {
  const results = [];
  for (const file of files) {
    results.push(await resizeImage(file, maxDimension));
  }
  return results;
}
