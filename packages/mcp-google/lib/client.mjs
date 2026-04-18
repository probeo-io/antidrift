import { google } from 'googleapis';
import { getAuthClient } from './auth-google.mjs';

export function createClient(_credentials) {
  async function getCal() {
    return google.calendar({ version: 'v3', auth: await getAuthClient() });
  }

  async function getGmail() {
    return google.gmail({ version: 'v1', auth: await getAuthClient() });
  }

  async function getDrive() {
    return google.drive({ version: 'v3', auth: await getAuthClient() });
  }

  async function getDocs() {
    return google.docs({ version: 'v1', auth: await getAuthClient() });
  }

  async function getSheets() {
    return google.sheets({ version: 'v4', auth: await getAuthClient() });
  }

  return { getCal, getGmail, getDrive, getDocs, getSheets };
}

export function formatEvent(e) {
  const start = e.start?.dateTime || e.start?.date || '';
  const startDate = new Date(start);
  const isAllDay = !e.start?.dateTime;
  const time = isAllDay ? 'All day' : startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  let line = `\uD83D\uDCC5 ${e.summary || '(No title)'}  \u2014  ${date}, ${time}`;
  if (e.location) line += `\n   \uD83D\uDCCD ${e.location}`;
  if (e.attendees?.length) {
    const names = e.attendees.map(a => a.displayName || a.email).slice(0, 5);
    line += `\n   \uD83D\uDC65 ${names.join(', ')}`;
    if (e.attendees.length > 5) line += ` +${e.attendees.length - 5} more`;
  }
  line += `  [id: ${e.id}]`;
  return line;
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
