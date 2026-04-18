export const API_BASE = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';

export function createClient(credentials, fetchFn = fetch) {
  async function notion(method, path, body) {
    const res = await fetchFn(`${API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
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

  return { notion, fetchAllChildren, fetchBlocksRecursive };
}

export function getPageTitle(page) {
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === 'title' && prop.title?.length) {
      return prop.title.map(t => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

export function formatPage(page) {
  const title = getPageTitle(page);
  return `\uD83D\uDCC4 ${title} [id: ${page.id}]`;
}

export function formatDatabase(db) {
  const title = db.title?.map(t => t.plain_text).join('') || 'Untitled';
  const propCount = Object.keys(db.properties || {}).length;
  return `\uD83D\uDDC4\uFE0F ${title} \u2014 ${propCount} properties [id: ${db.id}]`;
}

export function formatRichText(richTextArray) {
  if (!richTextArray?.length) return '';
  return richTextArray.map(t => t.plain_text).join('');
}

export function formatBlock(block, indent = 0) {
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
      return `${prefix}\u25B6 ${formatRichText(content.rich_text)}`;
    case 'code':
      return `${prefix}\`\`\`${content.language || ''}\n${prefix}${formatRichText(content.rich_text)}\n${prefix}\`\`\``;
    case 'quote':
      return `${prefix}> ${formatRichText(content.rich_text)}`;
    case 'callout':
      return `${prefix}\uD83D\uDCCC ${formatRichText(content.rich_text)}`;
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
      return `${prefix}\uD83D\uDCC4 ${content.title}`;
    case 'child_database':
      return `${prefix}\uD83D\uDDC4\uFE0F ${content.title}`;
    default:
      return `${prefix}[${type}]`;
  }
}

export function formatProperties(properties) {
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
        value = prop.checkbox ? '\u2705' : '\u2B1C';
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
