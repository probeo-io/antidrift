import { google } from 'googleapis';
import { getAuthClient } from './auth-google.mjs';

export function createClient(_credentials) {
  async function getDrive() {
    return google.drive({ version: 'v3', auth: await getAuthClient() });
  }

  async function getDocs() {
    return google.docs({ version: 'v1', auth: await getAuthClient() });
  }

  async function getSheets() {
    return google.sheets({ version: 'v4', auth: await getAuthClient() });
  }

  return { getDrive, getDocs, getSheets };
}
