import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CREDS_DIR = join(CONFIG_DIR, 'credentials', 'google');
const TOKEN_PATH = join(CREDS_DIR, 'token.json');
const CLIENT_PATH = join(CREDS_DIR, 'client.json');

const OAUTH_URL = 'https://antidrift.io/.well-known/google-oauth.json';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar'
];

async function fetchClientCredentials() {
  if (existsSync(CLIENT_PATH)) {
    return JSON.parse(readFileSync(CLIENT_PATH, 'utf8'));
  }

  console.log('  Fetching Google OAuth config...');
  const res = await fetch(OAUTH_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch OAuth config: ${res.status}`);
  }

  const creds = await res.json();
  mkdirSync(CREDS_DIR, { recursive: true });
  writeFileSync(CLIENT_PATH, JSON.stringify(creds, null, 2));
  return creds;
}

export async function getAuthClient() {
  const creds = await fetchClientCredentials();
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret);

  if (existsSync(TOKEN_PATH)) {
    const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
    oauth2.setCredentials(token);

    if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
      try {
        const { credentials } = await oauth2.refreshAccessToken();
        oauth2.setCredentials(credentials);
        writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
      } catch {
        return null;
      }
    }
  }

  return oauth2;
}

export function hasToken() {
  return existsSync(TOKEN_PATH);
}

export async function runAuthFlow() {
  const creds = await fetchClientCredentials();

  console.log('  Requesting authorization...\n');

  const deviceRes = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      scope: SCOPES.join(' '),
    }),
  });

  if (!deviceRes.ok) {
    const err = await deviceRes.text();
    throw new Error(`Device code request failed: ${err}`);
  }

  const device = await deviceRes.json();
  const { device_code, user_code, verification_url, interval, expires_in } = device;

  console.log(`  Go to: ${verification_url}`);
  console.log(`  Enter code: ${user_code}\n`);

  const { exec } = await import('child_process');
  const platform = process.platform;
  const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${openCmd} "${verification_url}"`);

  console.log('  Waiting for authorization...');

  const pollInterval = (interval || 5) * 1000;
  const deadline = Date.now() + (expires_in || 300) * 1000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollInterval));

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      mkdirSync(CREDS_DIR, { recursive: true });
      writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
      console.log(`\n  ✓ Authorized. Token saved.\n`);

      const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret);
      oauth2.setCredentials(tokenData);
      return oauth2;
    }

    if (tokenData.error === 'authorization_pending') continue;
    if (tokenData.error === 'slow_down') {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    throw new Error(`Authorization failed: ${tokenData.error_description || tokenData.error}`);
  }

  throw new Error('Authorization timed out. Please try again.');
}
