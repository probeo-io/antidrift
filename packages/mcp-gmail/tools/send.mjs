import { createClient } from './client.mjs';

export default {
  description: 'Send an email. Supports plain text emails.',
  input: {
    to: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body (plain text)' },
    cc: { type: 'string', description: 'CC email address (optional)', optional: true },
    bcc: { type: 'string', description: 'BCC email address (optional)', optional: true }
  },
  execute: async ({ to, subject, body, cc, bcc }, ctx) => {
    const { getGmail } = createClient(ctx.credentials);
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
    ];
    if (cc) lines.push(`Cc: ${cc}`);
    if (bcc) lines.push(`Bcc: ${bcc}`);
    lines.push('', body);

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    const res = await (await getGmail()).users.messages.send({ userId: 'me', requestBody: { raw } });
    return `\u2705 Sent to ${to}  [id: ${res.data.id}]`;
  }
};
