
import { supabase } from "../../lib/supabase";

const BUCKET = "ChurchDeskBucket";
const FOLDER = "membership-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[file.type];
}

/**
 * Validate an uploaded head photo before sending it to Supabase.
 */
export function validateMembershipHeadPhoto(file) {
  if (!file) return;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The image must be 1 MB or smaller.");
  }
}

/**
 * Convert a stored Storage path into a public image URL.
 * Also supports existing full URLs for backward compatibility.
 */
export function getMembershipHeadPhotoUrl(path) {
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl || null;
}

/**
 * Upload a membership head photo.
 * Returns the Storage path, NOT the public URL.
 */
export async function uploadMembershipHeadPhoto(file, membershipId) {
  if (!file) return null;

  validateMembershipHeadPhoto(file);

  if (!membershipId) {
    throw new Error(
      "A saved membership ID is required before uploading its photo."
    );
  }

  // Use a unique filename so the browser does not keep showing
  // a cached version of a previously uploaded image.
  const extension = getExtension(file);
  const filePath =
    `${FOLDER}/${membershipId}-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  return filePath;
}

/**
 * Delete a stored photo by its Storage path.
 */
export async function deleteMembershipHeadPhoto(path) {
  if (!path) return;

  if (/^https?:\/\//i.test(path)) {
    throw new Error(
      "A public URL was provided instead of a Storage path."
    );
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;
}
