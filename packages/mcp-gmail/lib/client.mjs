import { google } from 'googleapis';
import { getAuthClient } from './auth-google.mjs';

export function createClient(_credentials) {
  async function getGmail() {
    return google.gmail({ version: 'v1', auth: await getAuthClient() });
  }

  return { getGmail };
}

export function decodeBody(payload) {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf8');
    }
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, 'base64url').toString('utf8').replace(/<[^>]+>/g, '');
    }
  }
  return '';
}

export function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}
