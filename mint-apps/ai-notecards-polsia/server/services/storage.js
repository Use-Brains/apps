import { getStorageConfig } from '../config/runtime.js';

const BUCKET = 'avatars';

function trimTrailingSlash(value) {
  return value ? value.replace(/\/+$/, '') : value;
}

function getSupabaseUploadUrl(config, storagePath) {
  return `${trimTrailingSlash(config.supabaseUrl)}/storage/v1/object/${storagePath}`;
}

export function buildPublicStorageUrl(storagePath, options = {}, env = process.env) {
  if (!storagePath) return null;

  const { publicBaseUrl } = getStorageConfig(env);
  if (!publicBaseUrl) return null;

  const baseUrl = trimTrailingSlash(publicBaseUrl);
  const encodedPath = storagePath.replace(/^\/+/, '');
  const url = `${baseUrl}/${encodedPath}`;

  if (!options.cacheBust) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(options.cacheBust)}`;
}

export function resolveAvatarUrl(user, env = process.env) {
  if (user.avatar_url) {
    const cacheBust = user.updated_at ? new Date(user.updated_at).getTime() : null;
    const publicUrl = buildPublicStorageUrl(user.avatar_url, { cacheBust }, env);
    if (publicUrl) return publicUrl;
  }

  return user.google_avatar_url || null;
}

export async function uploadAvatar(userId, buffer, mime, env = process.env) {
  const config = getStorageConfig(env);
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const storagePath = `${BUCKET}/${userId}.${ext}`;

  if (config.provider !== 'supabase' || !config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Storage provider upload is not configured');
  }

  const res = await fetch(getSupabaseUploadUrl(config, storagePath), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
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

export async function deleteAvatar(storagePath, env = process.env) {
  if (!storagePath) return;

  const config = getStorageConfig(env);
  if (config.provider !== 'supabase' || !config.supabaseUrl || !config.serviceRoleKey) return;

  await fetch(getSupabaseUploadUrl(config, storagePath), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${config.serviceRoleKey}` },
  }).catch(() => {});
}
