// Which kind of deployment this is (#181). APP_STAGE=beta marks the V2 beta
// (chickensfarm-v2): every page shows the beta banner, reminders are off, and
// the version says so. Unset everywhere else, including V1 and — after cutover
// (#182) — V2 in production, so switching the beta off is an env change, not
// a code change.

export type AppStage = "beta";

export function appStage(): AppStage | null {
  return process.env.APP_STAGE === "beta" ? "beta" : null;
}

/**
 * The version shown on the profile screen. APP_VERSION alone is identical in
 * V1 and V2 (both come from package.json), so the beta adds its stage and
 * commit: "0.1.13 · V2 beta · b4ae5bc".
 */
export function appVersionLabel(): string {
  const version = process.env.APP_VERSION ?? "—";
  if (appStage() !== "beta") return version;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return [version, "V2 beta", commit].filter(Boolean).join(" · ");
}

/** Compact form stored with feedback (≤ 32 chars): "0.1.13-beta". */
export function appVersionTag(): string | null {
  const version = process.env.APP_VERSION;
  if (!version) return null;
  return appStage() === "beta" ? `${version}-beta` : version;
}
