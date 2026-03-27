import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let gmailApi = null;

async function getGmail() {
  if (!gmailApi) {
    gmailApi = google.gmail({ version: 'v1', auth: await getAuthClient() });
  }
  return gmailApi;
}

function decodeBody(payload) {
  // Try plain text first, then html
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

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

export const tools = [
  {
    name: 'gmail_search',
    description: 'Search Gmail messages. Uses Gmail search syntax (from:, to:, subject:, has:attachment, newer_than:, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g. "from:bob subject:invoice newer_than:7d")' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 10 }) => {
      const res = await (await getGmail()).users.messages.list({ userId: 'me', q: query, maxResults: limit });
      if (!res.data.messages?.length) return 'No messages found.';

      const messages = await Promise.all(res.data.messages.map(async (m) => {
        const msg = await (await getGmail()).users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers = msg.data.payload.headers;
        return `📧 ${getHeader(headers, 'Subject')}\n   From: ${getHeader(headers, 'From')}  •  ${getHeader(headers, 'Date')}  [id: ${m.id}]`;
      }));
      return messages.join('\n\n');
    }
  },
  {
    name: 'gmail_read',
    description: 'Read a specific email message by ID. Returns subject, from, to, date, and body text.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' }
      },
      required: ['messageId']
    },
    handler: async ({ messageId }) => {
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
  },
  {
    name: 'gmail_send',
    description: 'Send an email. Supports plain text emails.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC email address (optional)' },
        bcc: { type: 'string', description: 'BCC email address (optional)' }
      },
      required: ['to', 'subject', 'body']
    },
    handler: async ({ to, subject, body, cc, bcc }) => {
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
      return `✅ Sent to ${to}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'gmail_reply',
    description: 'Reply to an email thread.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID to reply to' },
        body: { type: 'string', description: 'Reply body (plain text)' }
      },
      required: ['messageId', 'body']
    },
    handler: async ({ messageId, body }) => {
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
      return `✅ Replied to ${from}  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'gmail_list_labels',
    description: 'List all Gmail labels.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const res = await (await getGmail()).users.labels.list({ userId: 'me' });
      if (!res.data.labels?.length) return 'No labels found.';
      return res.data.labels.map(l => `🏷️ ${l.name}  [id: ${l.id}]`).join('\n');
    }
  },
  {
    name: 'gmail_create_label',
    description: 'Create a new Gmail label.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Label name' }
      },
      required: ['name']
    },
    handler: async ({ name }) => {
      const res = await (await getGmail()).users.labels.create({
        userId: 'me',
        requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
      });
      return `✅ Label created: "${name}"  [id: ${res.data.id}]`;
    }
  },
  {
    name: 'gmail_add_label',
    description: 'Add a label to a message.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' },
        labelId: { type: 'string', description: 'The label ID (use gmail_list_labels to find)' }
      },
      required: ['messageId', 'labelId']
    },
    handler: async ({ messageId, labelId }) => {
      await (await getGmail()).users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { addLabelIds: [labelId] }
      });
      return `✅ Label added to message ${messageId}`;
    }
  },
  {
    name: 'gmail_remove_label',
    description: 'Remove a label from a message.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' },
        labelId: { type: 'string', description: 'The label ID' }
      },
      required: ['messageId', 'labelId']
    },
    handler: async ({ messageId, labelId }) => {
      await (await getGmail()).users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { removeLabelIds: [labelId] }
      });
      return `✅ Label removed from message ${messageId}`;
    }
  },
  {
    name: 'gmail_archive',
    description: 'Archive a message (remove from inbox).',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' }
      },
      required: ['messageId']
    },
    handler: async ({ messageId }) => {
      await (await getGmail()).users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { removeLabelIds: ['INBOX'] }
      });
      return `✅ Archived message ${messageId}`;
    }
  },
  {
    name: 'gmail_trash',
    description: 'Move a message to trash.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' }
      },
      required: ['messageId']
    },
    handler: async ({ messageId }) => {
      await (await getGmail()).users.messages.trash({ userId: 'me', id: messageId });
      return `✅ Trashed message ${messageId}`;
    }
  },
  {
    name: 'gmail_mark_read',
    description: 'Mark a message as read.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' }
      },
      required: ['messageId']
    },
    handler: async ({ messageId }) => {
      await (await getGmail()).users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { removeLabelIds: ['UNREAD'] }
      });
      return `✅ Marked as read: ${messageId}`;
    }
  },
  {
    name: 'gmail_mark_unread',
    description: 'Mark a message as unread.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message ID' }
      },
      required: ['messageId']
    },
    handler: async ({ messageId }) => {
      await (await getGmail()).users.messages.modify({
        userId: 'me', id: messageId,
        requestBody: { addLabelIds: ['UNREAD'] }
      });
      return `✅ Marked as unread: ${messageId}`;
    }
  },
  {
    name: 'gmail_list_drafts',
    description: 'List Gmail drafts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    },
    handler: async ({ limit = 10 }) => {
      const res = await (await getGmail()).users.drafts.list({ userId: 'me', maxResults: limit });
      if (!res.data.drafts?.length) return 'No drafts found.';
      const drafts = await Promise.all(res.data.drafts.map(async (d) => {
        const draft = await (await getGmail()).users.drafts.get({ userId: 'me', id: d.id, format: 'metadata' });
        const headers = draft.data.message.payload.headers;
        return `📝 ${getHeader(headers, 'Subject') || '(no subject)'}\n   To: ${getHeader(headers, 'To') || '(no recipient)'}  [id: ${d.id}]`;
      }));
      return drafts.join('\n\n');
    }
  },
  {
    name: 'gmail_create_draft',
    description: 'Create a draft email without sending it.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
        cc: { type: 'string', description: 'CC email address (optional)' }
      },
      required: ['to', 'subject', 'body']
    },
    handler: async ({ to, subject, body, cc }) => {
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
      return `✅ Draft created: "${subject}"  [id: ${res.data.id}]`;
    }
  }
];
