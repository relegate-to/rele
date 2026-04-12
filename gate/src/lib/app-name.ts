export function userAppName(userId: string): string {
  const short = userId.replace(/-/g, "").slice(0, 12);
  return `rele-u-${short}`;
}
