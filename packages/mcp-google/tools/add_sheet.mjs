import { createClient } from './client.mjs';

export default {
  description: 'Add a new sheet/tab to an existing Google Spreadsheet.',
  input: {
    spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
    title: { type: 'string', description: 'Name for the new sheet/tab' }
  },
  execute: async ({ spreadsheetId, title }, ctx) => {
    const { getCal, getGmail, getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getSheets()).spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
    const added = res.data.replies[0].addSheet.properties;
    return {
      sheetId: added.sheetId,
      title: added.title,
      index: added.index
    };
  }
};
