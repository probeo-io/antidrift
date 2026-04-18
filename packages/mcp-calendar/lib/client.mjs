import { google } from 'googleapis';
import { getAuthClient } from './auth-google.mjs';

export function createClient(_credentials) {
  async function getCal() {
    return google.calendar({ version: 'v3', auth: await getAuthClient() });
  }

  return { getCal };
}

export function formatEvent(e) {
  const start = e.start?.dateTime || e.start?.date || '';
  const end = e.end?.dateTime || e.end?.date || '';

  const startDate = new Date(start);
  const isAllDay = !e.start?.dateTime;
  const time = isAllDay ? 'All day' : startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  let line = `📅 ${e.summary || '(No title)'}  —  ${date}, ${time}`;
  if (e.location) line += `\n   📍 ${e.location}`;
  if (e.attendees?.length) {
    const names = e.attendees.map(a => a.displayName || a.email).slice(0, 5);
    line += `\n   👥 ${names.join(', ')}`;
    if (e.attendees.length > 5) line += ` +${e.attendees.length - 5} more`;
  }
  line += `  [id: ${e.id}]`;
  return line;
}
