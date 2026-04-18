import { createClient } from './client.mjs';

export default {
  description: 'Create a draft email without sending it.',
  input: {
    to: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body (plain text)' },
    cc: { type: 'string', description: 'CC email address (optional)', optional: true }
  },
  execute: async ({ to, subject, body, cc }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
    ];
    if (cc) lines.push(`Cc: ${cc}`);
    lines.push('', body);

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    const res = await (await getGmail()).users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } }
    });
    return `\u2705 Draft created: "${subject}"  [id: ${res.data.id}]`;
  }
};
