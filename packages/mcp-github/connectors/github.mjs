import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'github.json'), 'utf8'));

const API = 'https://api.github.com';
const HEADERS = {
  'Authorization': `Bearer ${config.token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

async function gh(method, path, body) {
  const opts = { method, headers: { ...HEADERS } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function ghRaw(path) {
  const res = await fetch(`${API}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.text();
}

function fmtRepo(r) {
  let line = `📦 ${r.full_name}`;
  if (r.description) line += ` — ${r.description}`;
  line += `  [⭐ ${r.stargazers_count}] [🔀 ${r.forks_count}]`;
  if (r.language) line += `  [${r.language}]`;
  return line;
}

function fmtIssue(i) {
  const labels = i.labels?.map(l => l.name).join(', ') || '';
  let line = `#${i.number} ${i.state === 'open' ? '🟢' : '🔴'} ${i.title}`;
  if (labels) line += `  [${labels}]`;
  line += `  by ${i.user?.login || '?'}`;
  return line;
}

function fmtPR(p) {
  let line = `#${p.number} ${p.state === 'open' ? '🟢' : p.merged_at ? '🟣' : '🔴'} ${p.title}`;
  line += `  ${p.head?.ref || '?'} → ${p.base?.ref || '?'}`;
  line += `  by ${p.user?.login || '?'}`;
  return line;
}

export const tools = [
  {
    name: 'github_user',
    description: 'Get the authenticated GitHub user\'s info.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const u = await gh('GET', '/user');
      const lines = [];
      lines.push(`👤 ${u.login}`);
      if (u.name) lines.push(`   Name: ${u.name}`);
      if (u.email) lines.push(`   Email: ${u.email}`);
      if (u.bio) lines.push(`   Bio: ${u.bio}`);
      lines.push(`   Public repos: ${u.public_repos}`);
      lines.push(`   Followers: ${u.followers} / Following: ${u.following}`);
      return lines.join('\n');
    }
  },
  {
    name: 'github_list_repos',
    description: 'List repositories for the authenticated user or an organization.',
    inputSchema: {
      type: 'object',
      properties: {
        org: { type: 'string', description: 'Organization name (optional — omit for your own repos)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        sort: { type: 'string', description: 'Sort by: stars, updated, pushed (default updated)' }
      }
    },
    handler: async ({ org, limit = 20, sort = 'updated' }) => {
      const path = org
        ? `/orgs/${encodeURIComponent(org)}/repos?per_page=${limit}&sort=${sort}`
        : `/user/repos?per_page=${limit}&sort=${sort}&affiliation=owner,collaborator,organization_member`;
      const repos = await gh('GET', path);
      if (!repos.length) return 'No repositories found.';
      return repos.map(fmtRepo).join('\n');
    }
  },
  {
    name: 'github_search_repos',
    description: 'Search GitHub repositories.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 20 }) => {
      const res = await gh('GET', `/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`);
      if (!res.items?.length) return `No repositories matching "${query}".`;
      return res.items.map(fmtRepo).join('\n');
    }
  },
  {
    name: 'github_get_repo',
    description: 'Get detailed information about a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo }) => {
      const r = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
      const lines = [];
      lines.push(`📦 ${r.full_name}`);
      if (r.description) lines.push(`   ${r.description}`);
      lines.push(`   ⭐ ${r.stargazers_count} stars  🔀 ${r.forks_count} forks  👁 ${r.watchers_count} watchers`);
      if (r.language) lines.push(`   Language: ${r.language}`);
      lines.push(`   Default branch: ${r.default_branch}`);
      lines.push(`   Visibility: ${r.visibility || (r.private ? 'private' : 'public')}`);
      if (r.homepage) lines.push(`   Homepage: ${r.homepage}`);
      lines.push(`   Created: ${r.created_at}`);
      lines.push(`   Updated: ${r.updated_at}`);
      lines.push(`   Open issues: ${r.open_issues_count}`);
      return lines.join('\n');
    }
  },
  {
    name: 'github_list_issues',
    description: 'List issues for a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', description: 'State: open, closed, all (default open)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        labels: { type: 'string', description: 'Comma-separated label names (optional)' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo, state = 'open', limit = 20, labels }) => {
      let path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=${limit}`;
      if (labels) path += `&labels=${encodeURIComponent(labels)}`;
      const issues = await gh('GET', path);
      // Filter out pull requests (GitHub includes PRs in the issues endpoint)
      const filtered = issues.filter(i => !i.pull_request);
      if (!filtered.length) return 'No issues found.';
      return filtered.map(fmtIssue).join('\n');
    }
  },
  {
    name: 'github_get_issue',
    description: 'Get issue details and comments.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        number: { type: 'number', description: 'Issue number' }
      },
      required: ['owner', 'repo', 'number']
    },
    handler: async ({ owner, repo, number }) => {
      const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const issue = await gh('GET', `${base}/issues/${number}`);
      const comments = await gh('GET', `${base}/issues/${number}/comments?per_page=50`);
      const lines = [];
      lines.push(`#${issue.number} ${issue.state === 'open' ? '🟢' : '🔴'} ${issue.title}`);
      lines.push(`   By: ${issue.user?.login || '?'}  •  ${issue.created_at}`);
      if (issue.labels?.length) lines.push(`   Labels: ${issue.labels.map(l => l.name).join(', ')}`);
      if (issue.assignees?.length) lines.push(`   Assignees: ${issue.assignees.map(a => a.login).join(', ')}`);
      if (issue.body) lines.push(`\n${issue.body}`);
      if (comments.length) {
        lines.push(`\n--- Comments (${comments.length}) ---`);
        for (const c of comments) {
          lines.push(`\n💬 ${c.user?.login || '?'} (${c.created_at}):`);
          lines.push(c.body);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 'github_create_issue',
    description: 'Create a new issue in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body (optional)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels (optional)' }
      },
      required: ['owner', 'repo', 'title']
    },
    handler: async ({ owner, repo, title, body, labels }) => {
      const data = { title };
      if (body) data.body = body;
      if (labels) data.labels = labels;
      const issue = await gh('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, data);
      return `✅ Created issue #${issue.number}: ${issue.title}\n   ${issue.html_url}`;
    }
  },
  {
    name: 'github_list_prs',
    description: 'List pull requests for a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', description: 'State: open, closed, all (default open)' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo, state = 'open', limit = 20 }) => {
      const prs = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=${state}&per_page=${limit}`);
      if (!prs.length) return 'No pull requests found.';
      return prs.map(fmtPR).join('\n');
    }
  },
  {
    name: 'github_get_pr',
    description: 'Get pull request details and files changed.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        number: { type: 'number', description: 'PR number' }
      },
      required: ['owner', 'repo', 'number']
    },
    handler: async ({ owner, repo, number }) => {
      const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const pr = await gh('GET', `${base}/pulls/${number}`);
      const files = await gh('GET', `${base}/pulls/${number}/files?per_page=100`);
      const lines = [];
      lines.push(`#${pr.number} ${pr.state === 'open' ? '🟢' : pr.merged_at ? '🟣 merged' : '🔴 closed'} ${pr.title}`);
      lines.push(`   ${pr.head?.ref || '?'} → ${pr.base?.ref || '?'}  by ${pr.user?.login || '?'}`);
      lines.push(`   +${pr.additions} / -${pr.deletions}  (${pr.changed_files} files)`);
      if (pr.body) lines.push(`\n${pr.body}`);
      if (files.length) {
        lines.push(`\n--- Files Changed (${files.length}) ---`);
        for (const f of files) {
          lines.push(`  ${f.status === 'added' ? '➕' : f.status === 'removed' ? '➖' : '✏️'}  ${f.filename}  (+${f.additions} -${f.deletions})`);
        }
      }
      return lines.join('\n');
    }
  },
  {
    name: 'github_pr_diff',
    description: 'Get the diff for a pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        number: { type: 'number', description: 'PR number' }
      },
      required: ['owner', 'repo', 'number']
    },
    handler: async ({ owner, repo, number }) => {
      const res = await fetch(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, {
        headers: {
          ...HEADERS,
          'Accept': 'application/vnd.github.diff'
        }
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
      return await res.text();
    }
  },
  {
    name: 'github_list_runs',
    description: 'List recent workflow runs for a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo, limit = 20 }) => {
      const res = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=${limit}`);
      if (!res.workflow_runs?.length) return 'No workflow runs found.';
      return res.workflow_runs.map(r => {
        const icon = r.conclusion === 'success' ? '✅' : r.conclusion === 'failure' ? '❌' : r.status === 'in_progress' ? '🔄' : '⏸️';
        return `${icon} ${r.name} #${r.run_number}  ${r.head_branch}  ${r.conclusion || r.status}  ${r.created_at}`;
      }).join('\n');
    }
  },
  {
    name: 'github_get_file',
    description: 'Read a file from a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        path: { type: 'string', description: 'File path in the repo' },
        ref: { type: 'string', description: 'Branch or commit (default main)' }
      },
      required: ['owner', 'repo', 'path']
    },
    handler: async ({ owner, repo, path, ref = 'main' }) => {
      const data = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
      if (data.type !== 'file') return `"${path}" is a ${data.type}, not a file.`;
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      return `📄 ${path} (${data.size} bytes, branch: ${ref})\n\n${content}`;
    }
  },
  {
    name: 'github_list_branches',
    description: 'List branches for a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo }) => {
      const branches = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
      if (!branches.length) return 'No branches found.';
      return branches.map(b => {
        const shield = b.protected ? '🛡️' : '  ';
        return `${shield} ${b.name}  ${b.commit?.sha?.slice(0, 7) || ''}`;
      }).join('\n');
    }
  },
  {
    name: 'github_list_releases',
    description: 'List releases for a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo, limit = 20 }) => {
      const releases = await gh('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${limit}`);
      if (!releases.length) return 'No releases found.';
      return releases.map(r => {
        let line = `🏷️ ${r.tag_name}`;
        if (r.name && r.name !== r.tag_name) line += ` — ${r.name}`;
        line += `  ${r.published_at || r.created_at}`;
        if (r.prerelease) line += '  [pre-release]';
        if (r.draft) line += '  [draft]';
        return line;
      }).join('\n');
    }
  },
  {
    name: 'github_repo_traffic',
    description: 'Get repository clone and view traffic (requires push access).',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['owner', 'repo']
    },
    handler: async ({ owner, repo }) => {
      const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/traffic`;
      const [views, clones] = await Promise.all([
        gh('GET', `${base}/views`),
        gh('GET', `${base}/clones`)
      ]);
      const lines = [];
      lines.push(`📊 Traffic for ${owner}/${repo} (last 14 days)`);
      lines.push(`\n   Views: ${views.count} total, ${views.uniques} unique`);
      if (views.views?.length) {
        for (const v of views.views) {
          lines.push(`     ${v.timestamp.slice(0, 10)}  ${v.count} views (${v.uniques} unique)`);
        }
      }
      lines.push(`\n   Clones: ${clones.count} total, ${clones.uniques} unique`);
      if (clones.clones?.length) {
        for (const c of clones.clones) {
          lines.push(`     ${c.timestamp.slice(0, 10)}  ${c.count} clones (${c.uniques} unique)`);
        }
      }
      return lines.join('\n');
    }
  }
];
