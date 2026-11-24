export async function uploadShare(
  photo: Blob,
  video: { blob: Blob; ext: string } | null,
  hours: 48 | 72,
): Promise<{ id: string; expiresAt: number }> {
  const form = new FormData()
  form.append('photo', photo, 'photo.jpg')
  if (video) form.append('video', video.blob, `video.${video.ext}`)

  const res = await fetch(`/api/share?hours=${hours}`, { method: 'POST', body: form })
  if (res.status === 413) throw new Error('The files are too large to share.')
  if (!res.ok) throw new Error('Upload failed. Check your connection and try again.')
  return res.json()
}