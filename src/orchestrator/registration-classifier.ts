import { isSafeServerAlias } from "./prompt-target.js";

export type RegistrationClassification = { matched: true; alias: string } | { matched: false };

export function classifyRegistrationPrompt(prompt: string): RegistrationClassification {
  const match = prompt.trim().match(/^add\s+remote\s+server\s+name\s+([a-zA-Z0-9._-]+)$/i);
  if (!match) return { matched: false };
  const alias = match[1];
  if (!isSafeServerAlias(alias)) {
    throw new Error("Invalid server alias");
  }
  return { matched: true, alias };
}
