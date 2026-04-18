import { createClient, decodeBody, getHeader } from './client.mjs';

export default {
  description: 'Read a specific email message by ID. Returns subject, from, to, date, and body text.',
  input: {
    messageId: { type: 'string', description: 'The message ID' }
  },
  execute: async ({ messageId }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const msg = await (await getGmail()).users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const headers = msg.data.payload.headers;
    const body = decodeBody(msg.data.payload);

    return [
      `Subject: ${getHeader(headers, 'Subject')}`,
      `From: ${getHeader(headers, 'From')}`,
      `To: ${getHeader(headers, 'To')}`,
      `Date: ${getHeader(headers, 'Date')}`,
      '',
      body
    ].join('\n');
  }
};
