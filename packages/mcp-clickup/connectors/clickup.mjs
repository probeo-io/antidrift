import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'clickup.json'), 'utf8'));

async function clickup(method, path, body) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    method,
    headers: {
      'Authorization': config.apiToken,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${err}`);
  }
  return res.json();
}

function priorityEmoji(p) {
  if (p === 1) return '\ud83d\udd34';
  if (p === 2) return '\ud83d\udfe0';
  if (p === 3) return '\ud83d\udfe1';
  if (p === 4) return '\ud83d\udd35';
  return '\u2b1c';
}

function formatTask(task) {
  const prio = task.priority ? parseInt(task.priority.id || task.priority, 10) : null;
  const emoji = priorityEmoji(prio);
  const status = task.status?.status || '';
  const assignees = (task.assignees || []).map(a => a.username || a.email || '').filter(Boolean).join(', ');
  let line = `\ud83d\udccb ${emoji} ${task.name} \u2014 ${status}`;
  if (assignees) line += ` [${assignees}]`;
  line += `  [id: ${task.id}]`;
  return line;
}

export const tools = [
  {
    name: 'clickup_list_workspaces',
    description: 'List all ClickUp workspaces (teams) you have access to.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await clickup('GET', '/team');
      const teams = res.teams || [];
      if (!teams.length) return 'No workspaces found.';
      return teams.map(t => `\ud83c\udfe2 ${t.name}  [id: ${t.id}]`).join('\n');
    }
  },
  {
    name: 'clickup_list_spaces',
    description: 'List spaces in a ClickUp workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The workspace/team ID' }
      },
      required: ['teamId']
    },
    handler: async ({ teamId }) => {
      const res = await clickup('GET', `/team/${teamId}/space`);
      const spaces = res.spaces || [];
      if (!spaces.length) return 'No spaces found.';
      return spaces.map(s => `\ud83d\udcc1 ${s.name}  [id: ${s.id}]`).join('\n');
    }
  },
  {
    name: 'clickup_list_folders',
    description: 'List folders in a ClickUp space.',
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: { type: 'string', description: 'The space ID' }
      },
      required: ['spaceId']
    },
    handler: async ({ spaceId }) => {
      const res = await clickup('GET', `/space/${spaceId}/folder`);
      const folders = res.folders || [];
      if (!folders.length) return 'No folders found.';
      return folders.map(f => `\ud83d\udcc2 ${f.name}  [id: ${f.id}]`).join('\n');
    }
  },
  {
    name: 'clickup_list_lists',
    description: 'List lists in a ClickUp folder or space. Provide either folderId or spaceId.',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', description: 'The folder ID (use this to list lists in a folder)' },
        spaceId: { type: 'string', description: 'The space ID (use this to list folderless lists in a space)' }
      }
    },
    handler: async ({ folderId, spaceId }) => {
      let res;
      if (folderId) {
        res = await clickup('GET', `/folder/${folderId}/list`);
      } else if (spaceId) {
        res = await clickup('GET', `/space/${spaceId}/list`);
      } else {
        return 'Provide either folderId or spaceId.';
      }
      const lists = res.lists || [];
      if (!lists.length) return 'No lists found.';
      return lists.map(l => `\ud83d\udcdd ${l.name}  [id: ${l.id}]`).join('\n');
    }
  },
  {
    name: 'clickup_list_tasks',
    description: 'List tasks in a ClickUp list.',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'The list ID' },
        statuses: { type: 'array', items: { type: 'string' }, description: 'Filter by status names (optional)' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Filter by assignee IDs (optional)' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      },
      required: ['listId']
    },
    handler: async ({ listId, statuses, assignees, limit = 50 }) => {
      let query = `?page=0`;
      if (statuses?.length) {
        query += statuses.map(s => `&statuses[]=${encodeURIComponent(s)}`).join('');
      }
      if (assignees?.length) {
        query += assignees.map(a => `&assignees[]=${encodeURIComponent(a)}`).join('');
      }
      const res = await clickup('GET', `/list/${listId}/task${query}`);
      const tasks = (res.tasks || []).slice(0, limit);
      if (!tasks.length) return 'No tasks found.';
      return tasks.map(formatTask).join('\n');
    }
  },
  {
    name: 'clickup_get_task',
    description: 'Get full details for a ClickUp task, including comments.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' }
      },
      required: ['taskId']
    },
    handler: async ({ taskId }) => {
      const task = await clickup('GET', `/task/${taskId}`);
      const lines = [];
      const prio = task.priority ? parseInt(task.priority.id || task.priority, 10) : null;
      lines.push(`${priorityEmoji(prio)} ${task.name}`);
      lines.push(`Status: ${task.status?.status || 'unknown'}`);
      if (task.description) lines.push(`Description: ${task.description}`);
      if (task.assignees?.length) lines.push(`Assignees: ${task.assignees.map(a => a.username || a.email).join(', ')}`);
      if (task.due_date) lines.push(`Due: ${new Date(parseInt(task.due_date)).toLocaleDateString()}`);
      if (task.tags?.length) lines.push(`Tags: ${task.tags.map(t => t.name).join(', ')}`);
      lines.push(`[id: ${task.id}]`);

      // Fetch comments
      try {
        const commentsRes = await clickup('GET', `/task/${taskId}/comment`);
        const comments = commentsRes.comments || [];
        if (comments.length) {
          lines.push('');
          lines.push('Comments:');
          for (const c of comments) {
            const author = c.user?.username || c.user?.email || 'unknown';
            const text = c.comment_text || '';
            const date = c.date ? new Date(parseInt(c.date)).toLocaleDateString() : '';
            lines.push(`  \ud83d\udcac ${author} (${date}): ${text}`);
          }
        }
      } catch {
        // comments may not be accessible
      }

      return lines.join('\n');
    }
  },
  {
    name: 'clickup_create_task',
    description: 'Create a new task in a ClickUp list.',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'The list ID to create the task in' },
        name: { type: 'string', description: 'Task name' },
        description: { type: 'string', description: 'Task description (optional)' },
        priority: { type: 'number', description: 'Priority: 1=urgent, 2=high, 3=normal, 4=low (optional)' },
        assignees: { type: 'array', items: { type: 'number' }, description: 'Array of assignee user IDs (optional)' },
        dueDate: { type: 'string', description: 'Due date as ISO string or unix ms (optional)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names (optional)' }
      },
      required: ['listId', 'name']
    },
    handler: async ({ listId, name, description, priority, assignees, dueDate, tags }) => {
      const body = { name };
      if (description) body.description = description;
      if (priority) body.priority = priority;
      if (assignees?.length) body.assignees = assignees;
      if (dueDate) {
        body.due_date = typeof dueDate === 'string' && dueDate.includes('-')
          ? new Date(dueDate).getTime()
          : parseInt(dueDate);
      }
      if (tags?.length) body.tags = tags;

      const res = await clickup('POST', `/list/${listId}/task`, body);
      return `\u2705 Created task: "${res.name}"  [id: ${res.id}]`;
    }
  },
  {
    name: 'clickup_update_task',
    description: 'Update a ClickUp task (name, description, status, priority, assignees, due date).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        name: { type: 'string', description: 'New task name (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        status: { type: 'string', description: 'New status name (optional)' },
        priority: { type: 'number', description: 'Priority: 1=urgent, 2=high, 3=normal, 4=low (optional)' },
        assignees: { type: 'object', description: 'Assignees object with "add" and/or "rem" arrays of user IDs (optional)' },
        dueDate: { type: 'string', description: 'Due date as ISO string or unix ms (optional)' }
      },
      required: ['taskId']
    },
    handler: async ({ taskId, name, description, status, priority, assignees, dueDate }) => {
      const body = {};
      if (name) body.name = name;
      if (description) body.description = description;
      if (status) body.status = status;
      if (priority) body.priority = priority;
      if (assignees) body.assignees = assignees;
      if (dueDate) {
        body.due_date = typeof dueDate === 'string' && dueDate.includes('-')
          ? new Date(dueDate).getTime()
          : parseInt(dueDate);
      }

      await clickup('PUT', `/task/${taskId}`, body);
      return `\u2705 Task ${taskId} updated`;
    }
  },
  {
    name: 'clickup_add_comment',
    description: 'Add a comment to a ClickUp task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        text: { type: 'string', description: 'Comment text' }
      },
      required: ['taskId', 'text']
    },
    handler: async ({ taskId, text }) => {
      await clickup('POST', `/task/${taskId}/comment`, { comment_text: text });
      return `\u2705 Comment added to task ${taskId}`;
    }
  },
  {
    name: 'clickup_search_tasks',
    description: 'Search tasks across a ClickUp workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'The workspace/team ID' },
        query: { type: 'string', description: 'Search query' }
      },
      required: ['teamId', 'query']
    },
    handler: async ({ teamId, query }) => {
      const res = await clickup('GET', `/team/${teamId}/task?search=${encodeURIComponent(query)}`);
      const tasks = res.tasks || [];
      if (!tasks.length) return `No tasks matching "${query}".`;
      return tasks.map(formatTask).join('\n');
    }
  },
  {
    name: 'clickup_list_statuses',
    description: 'List available statuses for a ClickUp list.',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'The list ID' }
      },
      required: ['listId']
    },
    handler: async ({ listId }) => {
      const res = await clickup('GET', `/list/${listId}`);
      const statuses = res.statuses || [];
      if (!statuses.length) return 'No statuses found.';
      return statuses.map(s => {
        const color = s.color ? ` (${s.color})` : '';
        return `\u25cf ${s.status}${color}  [type: ${s.type || 'custom'}]`;
      }).join('\n');
    }
  },
  {
    name: 'clickup_move_task',
    description: 'Move a ClickUp task to a different status.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        status: { type: 'string', description: 'The new status name' }
      },
      required: ['taskId', 'status']
    },
    handler: async ({ taskId, status }) => {
      await clickup('PUT', `/task/${taskId}`, { status });
      return `\u2705 Task ${taskId} moved to "${status}"`;
    }
  }
];
