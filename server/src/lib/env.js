import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ENV_PATH = resolve(__dirname, '../../../.env');

export const readEnv = () => {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
};

export const writeEnv = (updates) => {
  const content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf-8') : '';
  let updated = content;
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(updated)) {
      updated = updated.replace(regex, `${key}=${value}`);
    } else {
      updated = updated.trimEnd() + `\n${key}=${value}\n`;
    }
    process.env[key] = value;
  }
  writeFileSync(ENV_PATH, updated, 'utf-8');
};
