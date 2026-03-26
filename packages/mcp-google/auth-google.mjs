import { google } from 'googleapis';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { URL } from 'url';
import { exec } from 'child_process';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CREDS_DIR = join(CONFIG_DIR, 'credentials', 'google');
const TOKEN_PATH = join(CREDS_DIR, 'token.json');
const CLIENT_PATH = join(CREDS_DIR, 'client.json');

const OAUTH_URL = 'https://antidrift.io/.well-known/google-oauth.json';
const REDIRECT_URI = 'http://localhost:3847/callback';

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
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);

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
  console.log('  Step 1: Fetching OAuth config...');
  const creds = await fetchClientCredentials();
  console.log('  Step 1: ✓ Config loaded\n');

  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('  Step 2: Starting local server...');
  const code = await waitForCallback(authUrl);

  process.stdout.write('  Step 3: Waiting on Google...');
  const dots = setInterval(() => process.stdout.write('.'), 500);
  try {
    const { tokens } = await oauth2.getToken(code);
    clearInterval(dots);
    console.log(' ✓');
    oauth2.setCredentials(tokens);

    mkdirSync(CREDS_DIR, { recursive: true });
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('  Step 3: ✓ Token saved\n');
    console.log('  ✓ Authorized.\n');
  } catch (err) {
    clearInterval(dots);
    console.error(` ✗\n  Token exchange failed: ${err.message}\n`);
    throw err;
  }

  return oauth2;
}

function waitForCallback(authUrl) {
  return new Promise((resolve, reject) => {
    let timer;
    let resolved = false;
    const server = createServer((req, res) => {
      if (resolved) {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://localhost:3847');
      const code = url.searchParams.get('code');

      if (code) {
        resolved = true;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorized! You can close this tab.</h2>');
        console.log('  Step 2: ✓ Authorization code received\n');
        clearTimeout(timer);
        resolve(code);
      } else {
        res.writeHead(204);
        res.end();
      }
    });

    server.listen(3847, () => {
      console.log('  Step 2: ✓ Server listening on port 3847');
      console.log('  Step 2: Opening browser...\n');

      const platform = process.platform;
      const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} "${authUrl}"`);
      console.log('  Authorize in the browser. Waiting for callback...\n');
    });

    timer = setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 2 minutes'));
    }, 120000);
  });
}
