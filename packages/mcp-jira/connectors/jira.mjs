import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'jira.json'), 'utf8'));
const BASE_URL = `https://${config.domain}.atlassian.net`;
const AUTH = Buffer.from(`${config.email}:${config.token}`).toString('base64');

async function jira(method, path, body) {
  const isAgile = path.startsWith('/rest/agile/');
  const url = isAgile ? `${BASE_URL}${path}` : `${BASE_URL}/rest/api/3${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jira API ${res.status}: ${err}`);
  }
  // Some endpoints return 204 No Content
  if (res.status === 204) return {};
  return res.json();
}

/**
 * Recursively extract plain text from Atlassian Document Format (ADF) nodes.
 */
function extractAdfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) {
    return node.content.map(extractAdfText).join('');
  }
  if (Array.isArray(node)) {
    return node.map(extractAdfText).join('\n');
  }
  return '';
}

/**
 * Wrap plain text into ADF format for writing to Jira.
 */
function toAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: text || '' }]
    }]
  };
}

export const tools = [
  {
    name: 'jira_list_projects',
    description: 'List all Jira projects you have access to.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const projects = await jira('GET', '/project');
      if (!projects.length) return 'No projects found.';
      return projects.map(p => `\ud83d\udce6 ${p.key} \u2014 ${p.name} [id: ${p.id}]`).join('\n');
    }
  },
  {
    name: 'jira_get_project',
    description: 'Get details for a Jira project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
      },
      required: ['projectKey']
    },
    handler: async ({ projectKey }) => {
      const project = await jira('GET', `/project/${projectKey}`);
      const lines = [];
      lines.push(`\ud83d\udce6 ${project.key} \u2014 ${project.name}`);
      lines.push(`ID: ${project.id}`);
      if (project.description) lines.push(`Description: ${project.description}`);
      if (project.projectTypeKey) lines.push(`Type: ${project.projectTypeKey}`);
      if (project.lead?.displayName) lines.push(`Lead: ${project.lead.displayName}`);
      if (project.url) lines.push(`URL: ${project.url}`);
      return lines.join('\n');
    }
  },
  {
    name: 'jira_search_issues',
    description: 'Search Jira issues using JQL (Jira Query Language).',
    inputSchema: {
      type: 'object',
      properties: {
        jql: { type: 'string', description: 'JQL query string (e.g. "project = PROJ AND status = Open")' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['jql']
    },
    handler: async ({ jql, limit = 20 }) => {
      const fields = 'summary,status,assignee,priority,issuetype,created,updated';
      const res = await jira('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`);
      const issues = res.issues || [];
      if (!issues.length) return 'No issues found.';
      return issues.map(issue => {
        const f = issue.fields;
        const assignee = f.assignee?.displayName || 'Unassigned';
        const priority = f.priority?.name || '';
        const issueType = f.issuetype?.name || '';
        return `\ud83c\udfab ${issue.key} [${issueType}] ${f.summary} \u2014 ${f.status?.name || ''} (${assignee}) [${priority}]`;
      }).join('\n');
    }
  },
  {
    name: 'jira_get_issue',
    description: 'Get full details for a Jira issue, including description and comments.',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' }
      },
      required: ['issueKey']
    },
    handler: async ({ issueKey }) => {
      const issue = await jira('GET', `/issue/${issueKey}?fields=summary,description,status,assignee,reporter,priority,issuetype,created,updated,comment`);
      const f = issue.fields;
      const lines = [];
      lines.push(`\ud83c\udfab ${issue.key} [${f.issuetype?.name || ''}] ${f.summary}`);
      lines.push(`Status: ${f.status?.name || 'unknown'}`);
      lines.push(`Priority: ${f.priority?.name || 'None'}`);
      if (f.assignee?.displayName) lines.push(`Assignee: ${f.assignee.displayName}`);
      if (f.reporter?.displayName) lines.push(`Reporter: ${f.reporter.displayName}`);
      lines.push(`Created: ${f.created}`);
      lines.push(`Updated: ${f.updated}`);

      if (f.description) {
        const descText = extractAdfText(f.description);
        if (descText.trim()) lines.push(`\nDescription:\n${descText}`);
      }

      const comments = f.comment?.comments || [];
      if (comments.length) {
        lines.push('\nComments:');
        for (const c of comments) {
          const author = c.author?.displayName || 'unknown';
          const created = c.created || '';
          const body = extractAdfText(c.body);
          lines.push(`  \ud83d\udcac ${author} (${created}): ${body}`);
        }
      }

      return lines.join('\n');
    }
  },
  {
    name: 'jira_create_issue',
    description: 'Create a new Jira issue.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' },
        summary: { type: 'string', description: 'Issue summary/title' },
        description: { type: 'string', description: 'Issue description (plain text, will be converted to ADF)' },
        issueType: { type: 'string', description: 'Issue type name (default "Task")' },
        priority: { type: 'string', description: 'Priority name (e.g. "High", "Medium", "Low")' },
        assigneeId: { type: 'string', description: 'Assignee account ID' }
      },
      required: ['projectKey', 'summary']
    },
    handler: async ({ projectKey, summary, description, issueType = 'Task', priority, assigneeId }) => {
      const fields = {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType }
      };
      if (description) fields.description = toAdf(description);
      if (priority) fields.priority = { name: priority };
      if (assigneeId) fields.assignee = { accountId: assigneeId };

      const res = await jira('POST', '/issue', { fields });
      return `\u2705 Created issue: ${res.key} \u2014 "${summary}"`;
    }
  },
  {
    name: 'jira_update_issue',
    description: 'Update fields on a Jira issue (summary, description, priority, assignee).',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
        summary: { type: 'string', description: 'New summary (optional)' },
        description: { type: 'string', description: 'New description (optional, plain text)' },
        priority: { type: 'string', description: 'New priority name (optional)' },
        assigneeId: { type: 'string', description: 'New assignee account ID (optional)' }
      },
      required: ['issueKey']
    },
    handler: async ({ issueKey, summary, description, priority, assigneeId }) => {
      const fields = {};
      if (summary) fields.summary = summary;
      if (description) fields.description = toAdf(description);
      if (priority) fields.priority = { name: priority };
      if (assigneeId) fields.assignee = { accountId: assigneeId };

      await jira('PUT', `/issue/${issueKey}`, { fields });
      return `\u2705 Issue ${issueKey} updated`;
    }
  },
  {
    name: 'jira_transition_issue',
    description: 'Move a Jira issue to a new status by transition name.',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
        transitionName: { type: 'string', description: 'The transition name (e.g. "Done", "In Progress")' }
      },
      required: ['issueKey', 'transitionName']
    },
    handler: async ({ issueKey, transitionName }) => {
      const res = await jira('GET', `/issue/${issueKey}/transitions`);
      const transitions = res.transitions || [];
      const match = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());
      if (!match) {
        const available = transitions.map(t => t.name).join(', ');
        return `\u2717 Transition "${transitionName}" not found. Available: ${available}`;
      }
      await jira('POST', `/issue/${issueKey}/transitions`, { transition: { id: match.id } });
      return `\u2705 Issue ${issueKey} transitioned to "${match.name}"`;
    }
  },
  {
    name: 'jira_add_comment',
    description: 'Add a comment to a Jira issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
        body: { type: 'string', description: 'Comment text' }
      },
      required: ['issueKey', 'body']
    },
    handler: async ({ issueKey, body }) => {
      await jira('POST', `/issue/${issueKey}/comment`, { body: toAdf(body) });
      return `\u2705 Comment added to ${issueKey}`;
    }
  },
  {
    name: 'jira_assign_issue',
    description: 'Assign a Jira issue to a user.',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: 'The issue key (e.g. "PROJ-123")' },
        assigneeId: { type: 'string', description: 'The account ID of the assignee' }
      },
      required: ['issueKey', 'assigneeId']
    },
    handler: async ({ issueKey, assigneeId }) => {
      await jira('PUT', `/issue/${issueKey}/assignee`, { accountId: assigneeId });
      return `\u2705 Issue ${issueKey} assigned`;
    }
  },
  {
    name: 'jira_list_statuses',
    description: 'List available statuses for a Jira project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
      },
      required: ['projectKey']
    },
    handler: async ({ projectKey }) => {
      const issueTypes = await jira('GET', `/project/${projectKey}/statuses`);
      if (!issueTypes.length) return 'No statuses found.';
      const lines = [];
      for (const it of issueTypes) {
        lines.push(`\n${it.name}:`);
        for (const s of it.statuses || []) {
          lines.push(`  \u25cf ${s.name} [id: ${s.id}]`);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 'jira_list_users',
    description: 'List assignable users for a Jira project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
      },
      required: ['projectKey']
    },
    handler: async ({ projectKey }) => {
      const users = await jira('GET', `/user/assignable/search?project=${projectKey}`);
      if (!users.length) return 'No assignable users found.';
      return users.map(u => `\ud83d\udc64 ${u.displayName} \u2014 ${u.emailAddress || 'no email'} [id: ${u.accountId}]`).join('\n');
    }
  },
  {
    name: 'jira_list_sprints',
    description: 'List sprints for a Jira board.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'The board ID' }
      },
      required: ['boardId']
    },
    handler: async ({ boardId }) => {
      const res = await jira('GET', `/rest/agile/1.0/board/${boardId}/sprint`);
      const sprints = res.values || [];
      if (!sprints.length) return 'No sprints found.';
      return sprints.map(s => {
        const start = s.startDate || '?';
        const end = s.endDate || '?';
        return `\ud83c\udfc3 ${s.name} \u2014 ${s.state} (${start} - ${end})`;
      }).join('\n');
    }
  },
  {
    name: 'jira_get_board',
    description: 'List Jira boards, optionally filtered by project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Filter by project key (optional)' }
      }
    },
    handler: async ({ projectKey } = {}) => {
      const query = projectKey ? `?projectKeyOrId=${projectKey}` : '';
      const res = await jira('GET', `/rest/agile/1.0/board${query}`);
      const boards = res.values || [];
      if (!boards.length) return 'No boards found.';
      return boards.map(b => `\ud83d\udccb ${b.name} \u2014 ${b.type} [id: ${b.id}]`).join('\n');
    }
  },
  {
    name: 'jira_list_issue_types',
    description: 'List issue types available for a Jira project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'The project key (e.g. "PROJ")' }
      },
      required: ['projectKey']
    },
    handler: async ({ projectKey }) => {
      const project = await jira('GET', `/project/${projectKey}`);
      const issueTypes = project.issueTypes || [];
      if (!issueTypes.length) return 'No issue types found.';
      return issueTypes.map(t => `\u25cf ${t.name}${t.subtask ? ' (subtask)' : ''} \u2014 ${t.description || ''} [id: ${t.id}]`).join('\n');
    }
  },
  {
    name: 'jira_my_issues',
    description: 'Get Jira issues assigned to the current user (unresolved, ordered by priority).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 } = {}) => {
      const jql = 'assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC';
      const fields = 'summary,status,assignee,priority,issuetype,created,updated';
      const res = await jira('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=${fields}`);
      const issues = res.issues || [];
      if (!issues.length) return 'No issues assigned to you.';
      return issues.map(issue => {
        const f = issue.fields;
        const priority = f.priority?.name || '';
        const issueType = f.issuetype?.name || '';
        return `\ud83c\udfab ${issue.key} [${issueType}] ${f.summary} \u2014 ${f.status?.name || ''} [${priority}]`;
      }).join('\n');
    }
  }
];
