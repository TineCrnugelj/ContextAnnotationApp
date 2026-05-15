export interface IniConfig {
  [section: string]: Record<string, string>;
}

export function parseIni(text: string): IniConfig {
  const result: IniConfig = {};
  let currentSection = "global";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!result[currentSection]) result[currentSection] = {};
    result[currentSection][key] = value;
  }

  return result;
}

export function serializeIni(config: IniConfig): string {
  const lines: string[] = [];
  for (const [section, entries] of Object.entries(config)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`${key} = ${value}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
