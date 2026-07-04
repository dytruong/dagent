const SAFE_ALIAS = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/;

export interface ParsedPromptTarget {
  targetAlias?: string;
  prompt: string;
}

export function isSafeServerAlias(alias: string): boolean {
  return SAFE_ALIAS.test(alias) && !alias.includes("..");
}

export function parsePromptTarget(input: string): ParsedPromptTarget {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { prompt: trimmed };
  }

  const [rawAlias, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!rawAlias || !isSafeServerAlias(rawAlias)) {
    throw new Error("Invalid server alias");
  }

  return {
    targetAlias: rawAlias,
    prompt: rest.join(" ").trim(),
  };
}
