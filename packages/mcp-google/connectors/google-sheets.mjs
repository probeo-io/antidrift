import { google } from 'googleapis';
import { getAuthClient } from '../auth-google.mjs';

let sheetsApi = null;
let driveApi = null;

async function getSheets() {
  if (!sheetsApi) {
    sheetsApi = google.sheets({ version: 'v4', auth: await getAuthClient() });
  }
  return sheetsApi;
}

async function getDrive() {
  if (!driveApi) {
    driveApi = google.drive({ version: 'v3', auth: await getAuthClient() });
  }
  return driveApi;
}

export const tools = [
  {
    name: 'list_spreadsheets',
    description: 'List Google Sheets in your Drive. Optional query to filter by name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter by name' },
        limit: { type: 'number', description: 'Max results (default 20)' }
      }
    },
    handler: async ({ query, limit = 20 }) => {
      const q = query
        ? `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${query}'`
        : `mimeType='application/vnd.google-apps.spreadsheet'`;
      const res = await (await getDrive()).files.list({
        q, pageSize: limit,
        fields: 'files(id, name, modifiedTime, webViewLink)'
      });
      return res.data.files;
    }
  },
  {
    name: 'read_sheet',
    description: 'Read data from a Google Sheet range. Returns rows as arrays.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'Range like Sheet1!A1:D10 or just Sheet1' }
      },
      required: ['spreadsheetId', 'range']
    },
    handler: async ({ spreadsheetId, range }) => {
      const res = await (await getSheets()).spreadsheets.values.get({ spreadsheetId, range });
      return res.data.values || [];
    }
  },
  {
    name: 'write_sheet',
    description: 'Write data to a Google Sheet range.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'Range like Sheet1!A1' },
        values: { type: 'array', description: 'Array of rows (each row is an array of values)' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async ({ spreadsheetId, range, values }) => {
      const res = await (await getSheets()).spreadsheets.values.update({
        spreadsheetId, range,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      return { updatedCells: res.data.updatedCells };
    }
  },
  {
    name: 'append_sheet',
    description: 'Append rows to the end of a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'Sheet name like Sheet1' },
        values: { type: 'array', description: 'Array of rows to append' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async ({ spreadsheetId, range, values }) => {
      const res = await (await getSheets()).spreadsheets.values.append({
        spreadsheetId, range,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      return { updatedRows: res.data.updates?.updatedRows };
    }
  },
  {
    name: 'create_spreadsheet',
    description: 'Create a new Google Spreadsheet. Optionally provide initial sheet names.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Spreadsheet title' },
        sheets: { type: 'array', description: 'List of sheet/tab names to create (default: one sheet named Sheet1)', items: { type: 'string' } }
      },
      required: ['title']
    },
    handler: async ({ title, sheets }) => {
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
  },
  {
    name: 'add_sheet',
    description: 'Add a new sheet/tab to an existing Google Spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        title: { type: 'string', description: 'Name for the new sheet/tab' }
      },
      required: ['spreadsheetId', 'title']
    },
    handler: async ({ spreadsheetId, title }) => {
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
  },
  {
    name: 'get_sheet_info',
    description: 'Get spreadsheet metadata — title, sheets/tabs, row counts.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' }
      },
      required: ['spreadsheetId']
    },
    handler: async ({ spreadsheetId }) => {
      const res = await (await getSheets()).spreadsheets.get({ spreadsheetId });
      return {
        title: res.data.properties.title,
        sheets: res.data.sheets.map(s => ({
          title: s.properties.title,
          index: s.properties.index,
          rowCount: s.properties.gridProperties.rowCount,
          columnCount: s.properties.gridProperties.columnCount
        }))
      };
    }
  }
];
