import { google } from 'googleapis';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { URL } from 'url';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CREDS_PATH = join(CONFIG_DIR, 'google-credentials.json');
const TOKEN_PATH = join(CONFIG_DIR, 'google-token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar'
];

export function getAuthClient() {
  if (!existsSync(CREDS_PATH)) {
    throw new Error(`No credentials found at ${CREDS_PATH}. Run: npx antidrift mcp add google-sheets`);
  }

  const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
  const { client_id, client_secret, redirect_uris } = creds.installed;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3847');

  if (existsSync(TOKEN_PATH)) {
    const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    oauth2.setCredentials(token);
  }

  return oauth2;
}

export function hasToken() {
  return existsSync(TOKEN_PATH);
}

export async function runAuthFlow() {
  const oauth2 = getAuthClient();

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log(`\n  Opening browser for Google authorization...\n`);

  const { exec } = await import('child_process');
  const platform = process.platform;
  const open = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${open} "${authUrl}"`);

  const code = await waitForCallback();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`  Authorized. Token saved to ${TOKEN_PATH}\n`);

  return oauth2;
}

function waitForCallback() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3847');
      const code = url.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorized. You can close this tab.</h2>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end('Missing code');
      }
    });

    server.listen(3847, () => {
      console.log('  Waiting for authorization...');
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 2 minutes'));
    }, 120000);
  });
}
