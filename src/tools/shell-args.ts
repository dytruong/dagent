export function assertSafeArg(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
