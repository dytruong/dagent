export function createSessionPasswordCache() {
  const passwords = new Map<string, string>();
  return {
    get(alias: string): string | undefined {
      return passwords.get(alias);
    },
    set(alias: string, password: string): void {
      passwords.set(alias, password);
    },
    clear(): void {
      passwords.clear();
    },
  };
}
