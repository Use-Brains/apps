const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'avatars';

export const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public`;

export async function uploadAvatar(userId, buffer, mime) {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const storagePath = `${BUCKET}/${userId}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${storagePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    throw new Error(`Storage upload failed: ${res.status}`);
  }

  return storagePath;
}

export async function deleteAvatar(storagePath) {
  if (!storagePath) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${storagePath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  }).catch(() => {}); // best-effort cleanup
}
