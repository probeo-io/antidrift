import { createClient } from './client.mjs';

export default {
  description: 'Write formatted content to a Google Doc. Replaces all existing content. Supports markdown-style formatting: # Heading 1, ## Heading 2, **bold**, _italic_.',
  input: {
    documentId: { type: 'string', description: 'The Google Doc ID' },
    content: { type: 'string', description: 'Content with markdown-style formatting (# headings, **bold**, _italic_)' }
  },
  execute: async ({ documentId, content }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    // Clear existing content
    const doc = await (await getDocs()).documents.get({ documentId });
    const endIndex = doc.data.body.content.at(-1).endIndex - 1;
    const requests = [];

    if (endIndex > 1) {
      requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
    }

    // Parse markdown-style content into Google Docs requests
    const lines = content.split('\n');
    let insertIndex = 1;
    const bulletRanges = [];
    let prevParaStart = null;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Skip blank lines — add spacing to previous paragraph instead
      if (line.trim() === '') {
        if (prevParaStart !== null) {
          requests.push({ updateParagraphStyle: {
            range: { startIndex: prevParaStart, endIndex: insertIndex },
            paragraphStyle: { spaceBelow: { magnitude: 8, unit: 'PT' } },
            fields: 'spaceBelow'
          } });
        }
        continue;
      }

      // Skip --- horizontal rules
      if (line.trim() === '---') {
        if (prevParaStart !== null) {
          requests.push({ updateParagraphStyle: {
            range: { startIndex: prevParaStart, endIndex: insertIndex },
            paragraphStyle: { spaceBelow: { magnitude: 16, unit: 'PT' } },
            fields: 'spaceBelow'
          } });
        }
        continue;
      }

      const isBullet = line.startsWith('- ');
      const stripped = isBullet ? line.slice(2) : line;
      const text = stripped + '\n';
      const cleanText = text.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1');

      prevParaStart = insertIndex;
      requests.push({ insertText: { location: { index: insertIndex }, text: cleanText } });

      // Native bullet list
      if (isBullet) {
        bulletRanges.push({ startIndex: insertIndex, endIndex: insertIndex + cleanText.length });
      }

      // Heading styles
      if (stripped.startsWith('### ')) {
        requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_3' }, fields: 'namedStyleType' } });
      } else if (stripped.startsWith('## ')) {
        requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_2' }, fields: 'namedStyleType' } });
      } else if (stripped.startsWith('# ')) {
        requests.push({ updateParagraphStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + cleanText.length }, paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } });
      }

      // Apply bold
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let m;
      while ((m = boldRegex.exec(stripped)) !== null) {
        const before = stripped.substring(0, m.index).replace(/\*\*/g, '').replace(/^#{1,3}\s+/, '');
        const start = insertIndex + before.length;
        requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + m[1].length }, textStyle: { bold: true }, fields: 'bold' } });
      }

      // Apply italic
      const italicRegex = /(?<!\w)_([^_]+)_(?!\w)/g;
      while ((m = italicRegex.exec(stripped)) !== null) {
        const before = stripped.substring(0, m.index).replace(/\*\*/g, '').replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1').replace(/^#{1,3}\s+/, '');
        const start = insertIndex + before.length;
        requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + m[1].length }, textStyle: { italic: true }, fields: 'italic' } });
      }

      insertIndex += cleanText.length;
    }

    // Apply native bullet formatting
    for (const range of bulletRanges) {
      requests.push({ createParagraphBullets: { range, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
    }

    await (await getDocs()).documents.batchUpdate({ documentId, requestBody: { requests } });
    return `✅ Document updated — https://docs.google.com/document/d/${documentId}/edit`;
  }
};
