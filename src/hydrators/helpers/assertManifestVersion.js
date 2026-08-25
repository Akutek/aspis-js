const MANIFEST_MAJOR = 1;
function assertManifestVersion(raw, hydratorName) {
  if (!Object.prototype.hasOwnProperty.call(raw, "version") || raw.version == null || raw.version === "") {
    return;
  }
  const text = String(raw.version).trim();
  const major = Number.parseInt(text.split(".")[0] || "", 10);
  if (!Number.isFinite(major) || major !== MANIFEST_MAJOR) {
    throw new Error(
      `Aspis [${hydratorName}]: Manifest-Version '${text}' nicht unterst\xFCtzt (erwartet Major ${MANIFEST_MAJOR}).`
    );
  }
}
export {
  MANIFEST_MAJOR,
  assertManifestVersion
};
