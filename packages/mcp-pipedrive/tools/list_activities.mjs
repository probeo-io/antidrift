import { createClient } from './client.mjs';

export default {
  description: 'List activities (calls, meetings, tasks, emails) in Pipedrive.',
  input: {
    type: { type: 'string', description: 'Activity type: call, meeting, task, email, lunch, deadline', optional: true },
    done: { type: 'number', description: '0 for open, 1 for done', optional: true },
    limit: { type: 'number', description: 'Max results (default 20)', optional: true }
  },
  execute: async ({ type, done, limit = 20 }, ctx) => {
    const { pd } = createClient(ctx.credentials, ctx.fetch);
    let path = `/activities?limit=${limit}`;
    if (type) path += `&type=${type}`;
    if (done !== undefined) path += `&done=${done}`;
    const res = await pd('GET', path);
    if (!res.data?.length) return 'No activities found.';
    return res.data.map(a => {
      let line = `${a.done ? '\u2713' : '\u25CB'} ${a.type}: ${a.subject}`;
      if (a.due_date) line += `  (${a.due_date})`;
      if (a.person_name) line += `  \u2192 ${a.person_name}`;
      line += `  [id: ${a.id}]`;
      return line;
    }).join('\n');
  }
};
