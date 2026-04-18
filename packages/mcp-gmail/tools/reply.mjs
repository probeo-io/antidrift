import { createClient, getHeader } from './client.mjs';

export default {
  description: 'Reply to an email thread.',
  input: {
    messageId: { type: 'string', description: 'The message ID to reply to' },
    body: { type: 'string', description: 'Reply body (plain text)' }
  },
  execute: async ({ messageId, body }, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    const original = await (await getGmail()).users.messages.get({ userId: 'me', id: messageId, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Message-ID'] });
    const headers = original.data.payload.headers;
    const from = getHeader(headers, 'From');
    const subject = getHeader(headers, 'Subject');
    const msgId = getHeader(headers, 'Message-ID');

    const lines = [
      `To: ${from}`,
      `Subject: Re: ${subject.replace(/^Re:\s*/i, '')}`,
      `In-Reply-To: ${msgId}`,
      `References: ${msgId}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      body
    ];

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    const res = await (await getGmail()).users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: original.data.threadId }
    });
    return `\u2705 Replied to ${from}  [id: ${res.data.id}]`;
  }
};
