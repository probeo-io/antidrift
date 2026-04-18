import { createClient } from './client.mjs';

export default {
  description: 'Create a new Google Spreadsheet. Optionally provide initial sheet names.',
  input: {
    title: { type: 'string', description: 'Spreadsheet title' },
    sheets: { type: 'array', description: 'List of sheet/tab names to create (default: one sheet named Sheet1)', items: { type: 'string' }, optional: true }
  },
  execute: async ({ title, sheets }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const sheetsList = (sheets && sheets.length > 0)
      ? sheets.map((name, i) => ({ properties: { title: name, index: i } }))
      : undefined;
    const res = await (await getSheets()).spreadsheets.create({
      resource: {
        properties: { title },
        ...(sheetsList ? { sheets: sheetsList } : {})
      }
    });
    return {
      spreadsheetId: res.data.spreadsheetId,
      title: res.data.properties.title,
      url: res.data.spreadsheetUrl,
      sheets: res.data.sheets.map(s => s.properties.title)
    };
  }
};
