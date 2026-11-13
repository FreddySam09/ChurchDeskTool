
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

export function validateMembershipHeadPhoto(file) {
  if (!file) return;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("The image must be 5 MB or smaller.");
  }
}

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

export async function uploadMembershipHeadPhoto(file, membershipId) {
  if (!file) return null;

  validateMembershipHeadPhoto(file);

  if (!membershipId) {
    throw new Error(
      "A saved membership database ID is required before uploading its photo.",
    );
  }

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

  if (error) {
    throw new Error(error.message || "Could not upload the membership photo.");
  }

  return filePath;
}

export async function deleteMembershipHeadPhoto(path) {
  if (!path) return;

  if (/^https?:\/\//i.test(path)) {
    throw new Error("A Storage path is required to delete this photo.");
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(error.message || "Could not delete the membership photo.");
  }
}
