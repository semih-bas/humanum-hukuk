import assert from "node:assert/strict";
import test from "node:test";

import { hasValidProfileImageSignature, isAllowedProfileImageType, PROFILE_IMAGE_MAX_BYTES } from "../src/lib/profile-image";

test("profile images only allow safe raster formats", () => {
  assert.equal(isAllowedProfileImageType("image/jpeg"), true);
  assert.equal(isAllowedProfileImageType("image/png"), true);
  assert.equal(isAllowedProfileImageType("image/webp"), true);
  assert.equal(isAllowedProfileImageType("image/svg+xml"), false);
  assert.equal(PROFILE_IMAGE_MAX_BYTES, 1024 * 1024);
});

test("profile image signatures must match the declared type", () => {
  assert.equal(hasValidProfileImageSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff])), true);
  assert.equal(hasValidProfileImageSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidProfileImageSignature("image/webp", new TextEncoder().encode("RIFF0000WEBP")), true);
  assert.equal(hasValidProfileImageSignature("image/png", new TextEncoder().encode("not an image")), false);
});
