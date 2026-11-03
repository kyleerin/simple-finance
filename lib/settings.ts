/** Settings is signed-in app chrome; keep it off the login screen. */
export function showAppSettings(pathname: string | null): boolean {
  return pathname !== "/login";
}
