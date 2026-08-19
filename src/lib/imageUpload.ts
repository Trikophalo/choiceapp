/**
 * Turns a user-picked photo into a small data URI suitable for storing inside
 * a card (and therefore inside a synced group session): downscaled to card
 * size and JPEG-compressed, retrying at lower quality until it fits the
 * budget. Runs entirely on the device — the photo never touches a server
 * other than the session store the deck itself lives in.
 */

const MAX_DIMENSION = 640
/** Hard cap per image; keeps a full custom deck well inside session budgets. */
export const MAX_IMAGE_BYTES = 90_000
/** Cap across all entries, so a 40-card deck cannot balloon a group session. */
export const MAX_TOTAL_IMAGE_BYTES = 1_500_000

const QUALITY_STEPS = [0.8, 0.65, 0.5, 0.35]

export function dataUriBytes(uri: string): number {
  const base64 = uri.slice(uri.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image')

  const bitmap = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.drawImage(bitmap, 0, 0, width, height)

  for (const quality of QUALITY_STEPS) {
    const uri = canvas.toDataURL('image/jpeg', quality)
    if (dataUriBytes(uri) <= MAX_IMAGE_BYTES) return uri
  }
  throw new Error('image-too-large')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image-load-failed'))
    }
    image.src = url
  })
}
