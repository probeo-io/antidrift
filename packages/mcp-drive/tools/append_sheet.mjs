import { createClient } from './client.mjs';

export default {
  description: 'Append rows to the end of a Google Sheet.',
  input: {
    spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
    range: { type: 'string', description: 'Sheet name like Sheet1' },
    values: { type: 'array', description: 'Array of rows to append' }
  },
  execute: async ({ spreadsheetId, range, values }, ctx) => {
    const { getDrive, getDocs, getSheets } = createClient(ctx.credentials);
    const res = await (await getSheets()).spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    return { updatedRows: res.data.updates?.updatedRows };
  }
};
