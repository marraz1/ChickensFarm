import { READ_ONLY_BANNER, isReadOnlyMode } from "@/lib/read-only";

// Shown on every page while V1 is frozen for the move to V2 (#239). Static
// pages (sign-in, register) are prerendered, so the banner is fixed at build
// time: a change of READ_ONLY_MODE needs a rebuild (Vercel's Redeploy), not a
// promote or an instant rollback of an older build.
export function ReadOnlyBanner() {
  if (!isReadOnlyMode()) return null;
  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950"
    >
      {READ_ONLY_BANNER}
    </div>
  );
}
