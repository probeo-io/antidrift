import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = JSON.parse(readFileSync(join(homedir(), '.antidrift', 'notion.json'), 'utf8'));

const API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function notion(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function getPageTitle(page) {
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === 'title' && prop.title?.length) {
      return prop.title.map(t => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

function formatPage(page) {
  const title = getPageTitle(page);
  return `\ud83d\udcc4 ${title} [id: ${page.id}]`;
}

function formatDatabase(db) {
  const title = db.title?.map(t => t.plain_text).join('') || 'Untitled';
  const propCount = Object.keys(db.properties || {}).length;
  return `\ud83d\uddc4\ufe0f ${title} \u2014 ${propCount} properties [id: ${db.id}]`;
}

function formatRichText(richTextArray) {
  if (!richTextArray?.length) return '';
  return richTextArray.map(t => t.plain_text).join('');
}

function formatBlock(block, indent = 0) {
  const prefix = '  '.repeat(indent);
  const type = block.type;

  if (!type) return `${prefix}[unknown block]`;

  const content = block[type];
  if (!content) return `${prefix}[${type}]`;

  switch (type) {
    case 'paragraph':
      return `${prefix}${formatRichText(content.rich_text)}`;
    case 'heading_1':
      return `${prefix}# ${formatRichText(content.rich_text)}`;
    case 'heading_2':
      return `${prefix}## ${formatRichText(content.rich_text)}`;
    case 'heading_3':
      return `${prefix}### ${formatRichText(content.rich_text)}`;
    case 'bulleted_list_item':
      return `${prefix}- ${formatRichText(content.rich_text)}`;
    case 'numbered_list_item':
      return `${prefix}1. ${formatRichText(content.rich_text)}`;
    case 'to_do': {
      const check = content.checked ? '[x]' : '[ ]';
      return `${prefix}- ${check} ${formatRichText(content.rich_text)}`;
    }
    case 'toggle':
      return `${prefix}\u25b6 ${formatRichText(content.rich_text)}`;
    case 'code':
      return `${prefix}\`\`\`${content.language || ''}\n${prefix}${formatRichText(content.rich_text)}\n${prefix}\`\`\``;
    case 'quote':
      return `${prefix}> ${formatRichText(content.rich_text)}`;
    case 'callout':
      return `${prefix}\ud83d\udccc ${formatRichText(content.rich_text)}`;
    case 'divider':
      return `${prefix}---`;
    case 'image':
      return `${prefix}[Image: ${content.external?.url || content.file?.url || 'embedded'}]`;
    case 'bookmark':
      return `${prefix}[Bookmark: ${content.url || ''}]`;
    case 'link_preview':
      return `${prefix}[Link: ${content.url || ''}]`;
    case 'table_of_contents':
      return `${prefix}[Table of Contents]`;
    case 'child_page':
      return `${prefix}\ud83d\udcc4 ${content.title}`;
    case 'child_database':
      return `${prefix}\ud83d\uddc4\ufe0f ${content.title}`;
    default:
      return `${prefix}[${type}]`;
  }
}

async function fetchAllChildren(blockId) {
  const blocks = [];
  let cursor;

  do {
    const url = `/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ''}`;
    const res = await notion('GET', url);
    blocks.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  return blocks;
}

async function fetchBlocksRecursive(blockId, depth = 0, maxDepth = 3) {
  const blocks = await fetchAllChildren(blockId);
  const lines = [];

  for (const block of blocks) {
    lines.push(formatBlock(block, depth));
    if (block.has_children && depth < maxDepth) {
      const childLines = await fetchBlocksRecursive(block.id, depth + 1, maxDepth);
      lines.push(...childLines);
    }
  }

  return lines;
}

function formatProperties(properties) {
  const lines = [];
  for (const [key, prop] of Object.entries(properties)) {
    let value = '';
    switch (prop.type) {
      case 'title':
        value = formatRichText(prop.title);
        break;
      case 'rich_text':
        value = formatRichText(prop.rich_text);
        break;
      case 'number':
        value = prop.number != null ? String(prop.number) : '';
        break;
      case 'select':
        value = prop.select?.name || '';
        break;
      case 'multi_select':
        value = (prop.multi_select || []).map(s => s.name).join(', ');
        break;
      case 'date':
        value = prop.date?.start || '';
        if (prop.date?.end) value += ` \u2192 ${prop.date.end}`;
        break;
      case 'checkbox':
        value = prop.checkbox ? '\u2705' : '\u2b1c';
        break;
      case 'url':
        value = prop.url || '';
        break;
      case 'email':
        value = prop.email || '';
        break;
      case 'phone_number':
        value = prop.phone_number || '';
        break;
      case 'status':
        value = prop.status?.name || '';
        break;
      case 'people':
        value = (prop.people || []).map(p => p.name || p.id).join(', ');
        break;
      case 'relation':
        value = (prop.relation || []).map(r => r.id).join(', ');
        break;
      case 'formula':
        value = prop.formula?.string || prop.formula?.number?.toString() || prop.formula?.boolean?.toString() || '';
        break;
      case 'rollup':
        value = prop.rollup?.number?.toString() || prop.rollup?.array?.length?.toString() || '';
        break;
      case 'created_time':
        value = prop.created_time || '';
        break;
      case 'last_edited_time':
        value = prop.last_edited_time || '';
        break;
      case 'created_by':
        value = prop.created_by?.name || prop.created_by?.id || '';
        break;
      case 'last_edited_by':
        value = prop.last_edited_by?.name || prop.last_edited_by?.id || '';
        break;
      case 'files':
        value = (prop.files || []).map(f => f.name || f.external?.url || f.file?.url || '').join(', ');
        break;
      default:
        value = `[${prop.type}]`;
    }
    if (value) lines.push(`  ${key}: ${value}`);
  }
  return lines;
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const tools = [
  {
    name: 'notion_search',
    description: 'Search pages and databases in Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query = '', limit = 20 }) => {
      const body = { page_size: Math.min(limit, 100) };
      if (query) body.query = query;
      const res = await notion('POST', '/search', body);
      if (!res.results?.length) return 'No results found.';
      return res.results.map(item => {
        if (item.object === 'database') return formatDatabase(item);
        return formatPage(item);
      }).join('\n');
    }
  },
  {
    name: 'notion_get_page',
    description: 'Get page properties from Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'The page ID' }
      },
      required: ['pageId']
    },
    handler: async ({ pageId }) => {
      const page = await notion('GET', `/pages/${pageId}`);
      const title = getPageTitle(page);
      const lines = [`\ud83d\udcc4 ${title} [id: ${page.id}]`, ''];
      lines.push(...formatProperties(page.properties));
      if (page.url) lines.push(`  URL: ${page.url}`);
      return lines.join('\n');
    }
  },
  {
    name: 'notion_get_page_content',
    description: 'Get page content (blocks) from Notion. Recursively fetches child blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'The page ID' }
      },
      required: ['pageId']
    },
    handler: async ({ pageId }) => {
      const page = await notion('GET', `/pages/${pageId}`);
      const title = getPageTitle(page);
      const lines = [`\ud83d\udcc4 ${title}`, ''];
      const contentLines = await fetchBlocksRecursive(pageId);
      lines.push(...contentLines);
      return lines.join('\n');
    }
  },
  {
    name: 'notion_list_databases',
    description: 'List databases the Notion integration can access.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ limit = 20 }) => {
      const res = await notion('POST', '/search', {
        filter: { value: 'database', property: 'object' },
        page_size: Math.min(limit, 100)
      });
      if (!res.results?.length) return 'No databases found.';
      return res.results.map(formatDatabase).join('\n');
    }
  },
  {
    name: 'notion_query_database',
    description: 'Query a Notion database. Returns pages matching the filter.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string', description: 'The database ID' },
        filter: { type: 'object', description: 'Notion filter object (optional)' },
        sorts: { type: 'array', description: 'Notion sorts array (optional)' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      },
      required: ['databaseId']
    },
    handler: async ({ databaseId, filter, sorts, limit = 20 }) => {
      const body = { page_size: Math.min(limit, 100) };
      if (filter) body.filter = filter;
      if (sorts) body.sorts = sorts;
      const res = await notion('POST', `/databases/${databaseId}/query`, body);
      if (!res.results?.length) return 'No results found.';
      return res.results.map(page => {
        const title = getPageTitle(page);
        const props = formatProperties(page.properties);
        return [`\ud83d\udcc4 ${title} [id: ${page.id}]`, ...props].join('\n');
      }).join('\n\n');
    }
  },
  {
    name: 'notion_get_database',
    description: 'Get database schema and properties from Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string', description: 'The database ID' }
      },
      required: ['databaseId']
    },
    handler: async ({ databaseId }) => {
      const db = await notion('GET', `/databases/${databaseId}`);
      const title = db.title?.map(t => t.plain_text).join('') || 'Untitled';
      const lines = [`\ud83d\uddc4\ufe0f ${title} [id: ${db.id}]`, ''];
      lines.push('Properties:');
      for (const [name, prop] of Object.entries(db.properties || {})) {
        let detail = prop.type;
        if (prop.type === 'select' && prop.select?.options?.length) {
          detail += `: ${prop.select.options.map(o => o.name).join(', ')}`;
        }
        if (prop.type === 'multi_select' && prop.multi_select?.options?.length) {
          detail += `: ${prop.multi_select.options.map(o => o.name).join(', ')}`;
        }
        if (prop.type === 'status' && prop.status?.options?.length) {
          detail += `: ${prop.status.options.map(o => o.name).join(', ')}`;
        }
        lines.push(`  ${name} (${detail})`);
      }
      return lines.join('\n');
    }
  },
  {
    name: 'notion_list_users',
    description: 'List workspace users in Notion.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const res = await notion('GET', '/users');
      if (!res.results?.length) return 'No users found.';
      return res.results.map(user => {
        const type = user.type === 'bot' ? '\ud83e\udd16' : '\ud83d\udc64';
        return `${type} ${user.name || 'Unknown'} (${user.type}) [id: ${user.id}]`;
      }).join('\n');
    }
  },
  {
    name: 'notion_get_block',
    description: 'Get a specific block from Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string', description: 'The block ID' }
      },
      required: ['blockId']
    },
    handler: async ({ blockId }) => {
      const block = await notion('GET', `/blocks/${blockId}`);
      return formatBlock(block);
    }
  },
  {
    name: 'notion_get_block_children',
    description: 'Get children of a block in Notion.',
    inputSchema: {
      type: 'object',
      properties: {
        blockId: { type: 'string', description: 'The block ID' }
      },
      required: ['blockId']
    },
    handler: async ({ blockId }) => {
      const blocks = await fetchAllChildren(blockId);
      if (!blocks.length) return 'No child blocks found.';
      return blocks.map(b => formatBlock(b)).join('\n');
    }
  }
];
