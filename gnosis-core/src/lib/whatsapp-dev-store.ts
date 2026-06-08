// globalThis ensures the Map survives Next.js hot-module reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __devOtpStore: Map<string, { code: string; expires: number }> | undefined
}

export const devOtpStore: Map<string, { code: string; expires: number }> =
  globalThis.__devOtpStore ?? (globalThis.__devOtpStore = new Map())
