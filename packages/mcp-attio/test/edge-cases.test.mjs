import { describe, it, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'attio.json');
const BACKUP_PATH = CONFIG_PATH + '.edge-test-backup';

let tools;
let findTool;

before(async () => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (existsSync(CONFIG_PATH)) {
    rmSync(BACKUP_PATH, { force: true });
    writeFileSync(BACKUP_PATH, readFileSync(CONFIG_PATH));
  }
  writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey: 'test-fake-key' }));

  const mod = await import('../connectors/attio.mjs');
  tools = mod.tools;

  if (existsSync(BACKUP_PATH)) {
    writeFileSync(CONFIG_PATH, readFileSync(BACKUP_PATH));
    rmSync(BACKUP_PATH, { force: true });
  } else {
    rmSync(CONFIG_PATH, { force: true });
  }

  findTool = (name) => tools.find(t => t.name === name);
});

afterEach(() => {
  mock.restoreAll();
});

// --- Helpers ---

function mockFetch(responseData, status = 200) {
  return mock.method(globalThis, 'fetch', async (url, opts) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseData,
    text: async () => JSON.stringify(responseData)
  }));
}

function lastFetchBody(mockedFetch) {
  const calls = mockedFetch.mock.calls;
  const opts = calls[calls.length - 1].arguments[1];
  return opts.body ? JSON.parse(opts.body) : undefined;
}

function lastFetchUrl(mockedFetch) {
  const calls = mockedFetch.mock.calls;
  return calls[calls.length - 1].arguments[0];
}

// --- Edge-case tests ---

describe('attio edge cases', () => {

  // ─── Error responses ─────────────────────────────────────────────────────

  describe('error responses', () => {
    it('throws on 401 unauthorized', async () => {
      mockFetch({ message: 'Unauthorized' }, 401);
      await assert.rejects(
        () => findTool('attio_search_people').handler({ query: 'test' }),
        (err) => { assert.ok(err.message.includes('401')); return true; }
      );
    });

    it('throws on 404 not found', async () => {
      mockFetch({ message: 'Not Found' }, 404);
      await assert.rejects(
        () => findTool('attio_get_person').handler({ recordId: 'no-such-id' }),
        (err) => { assert.ok(err.message.includes('404')); return true; }
      );
    });

    it('throws on 429 rate limited', async () => {
      mockFetch({ message: 'Too Many Requests' }, 429);
      await assert.rejects(
        () => findTool('attio_list_people').handler({}),
        (err) => { assert.ok(err.message.includes('429')); return true; }
      );
    });

    it('throws on 500 server error', async () => {
      mockFetch({ message: 'Internal Server Error' }, 500);
      await assert.rejects(
        () => findTool('attio_list_companies').handler({}),
        (err) => { assert.ok(err.message.includes('500')); return true; }
      );
    });
  });

  // ─── Empty result sets ────────────────────────────────────────────────────

  describe('empty result sets', () => {
    it('attio_list_people returns message for empty data', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_people').handler({});
      assert.equal(result, 'No people found.');
    });

    it('attio_list_companies returns message for empty data', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_companies').handler({});
      assert.equal(result, 'No companies found.');
    });

    it('attio_list_deals returns message for empty data', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_deals').handler({});
      assert.equal(result, 'No deals found.');
    });

    it('attio_list_tasks returns message for empty data', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_tasks').handler({});
      assert.equal(result, 'No tasks found.');
    });

    it('attio_search_people returns no-match message for empty results', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_search_people').handler({ query: 'zzz' });
      assert.ok(result.includes('No people matching'));
    });

    it('attio_search_companies returns no-match message for empty results', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_search_companies').handler({ query: 'zzz' });
      assert.ok(result.includes('No companies matching'));
    });

    it('attio_list_people handles null data gracefully', async () => {
      mockFetch({});
      const result = await findTool('attio_list_people').handler({});
      assert.equal(result, 'No people found.');
    });
  });

  // ─── Pagination / limit params ────────────────────────────────────────────

  describe('pagination and limit', () => {
    it('attio_list_people sends custom limit', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_people').handler({ limit: 5 });
      assert.equal(lastFetchBody(mocked).limit, 5);
    });

    it('attio_list_companies sends custom limit', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_companies').handler({ limit: 10 });
      assert.equal(lastFetchBody(mocked).limit, 10);
    });

    it('attio_list_deals sends custom limit', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_deals').handler({ limit: 3 });
      assert.equal(lastFetchBody(mocked).limit, 3);
    });

    it('attio_list_tasks sends limit as query parameter', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_tasks').handler({ limit: 7 });
      assert.ok(lastFetchUrl(mocked).includes('limit=7'));
    });

    it('attio_list_people defaults limit to 20', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_people').handler({});
      assert.equal(lastFetchBody(mocked).limit, 20);
    });

    it('attio_list_tasks defaults limit to 20', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_tasks').handler({});
      assert.ok(lastFetchUrl(mocked).includes('limit=20'));
    });
  });

  // ─── Optional parameters omitted ─────────────────────────────────────────

  describe('optional parameters omitted', () => {
    it('attio_create_person omits name when no firstName/lastName', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'r-new' }, values: {} } });
      await findTool('attio_create_person').handler({ email: 'solo@test.com' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.name, undefined);
      assert.equal(body.data.values.job_title, undefined);
    });

    it('attio_create_person omits jobTitle when not provided', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'r-new' }, values: {} } });
      await findTool('attio_create_person').handler({ email: 'a@b.com', firstName: 'A' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.job_title, undefined);
    });

    it('attio_create_company omits domains when not provided', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'c-new' }, values: {} } });
      await findTool('attio_create_company').handler({ name: 'NoDomain' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.domains, undefined);
    });

    it('attio_create_task sends required fields with null/empty defaults', async () => {
      const mocked = mockFetch({ data: { id: { task_id: 't-new' } } });
      await findTool('attio_create_task').handler({ content: 'simple task' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.deadline_at, null);
      assert.deepEqual(body.data.linked_records, []);
      assert.deepEqual(body.data.assignees, []);
    });
  });

  // ─── Special characters ───────────────────────────────────────────────────

  describe('special characters in input', () => {
    it('attio_search_people handles special characters in query', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_search_people').handler({ query: 'O\'Brien & Co <script>' });
      const body = lastFetchBody(mocked);
      assert.equal(body.filter['$or'][0].name['$contains'], 'O\'Brien & Co <script>');
    });

    it('attio_create_company handles special characters in name', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'c-sp' }, values: {} } });
      const result = await findTool('attio_create_company').handler({ name: 'Uber & Lyft "Rides"' });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.name, [{ value: 'Uber & Lyft "Rides"' }]);
      assert.ok(result.includes('Uber & Lyft "Rides"'));
    });

    it('attio_create_person handles unicode in names', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'r-uni' }, values: {} } });
      const result = await findTool('attio_create_person').handler({
        email: 'test@test.com',
        firstName: 'Rene',
        lastName: 'Descartes'
      });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.name[0].first_name, 'Rene');
    });

    it('attio_add_note handles multiline content', async () => {
      const mocked = mockFetch({ data: { id: { note_id: 'n-ml' } } });
      const content = 'Line 1\nLine 2\n\nLine 4';
      await findTool('attio_add_note').handler({
        objectType: 'people',
        recordId: 'r1',
        title: 'Multi-line',
        content
      });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.content, content);
      assert.equal(body.data.format, 'plaintext');
    });

    it('attio_get_person handles recordId with special chars in URL', async () => {
      const mocked = mockFetch({
        data: {
          id: { record_id: 'abc-123' },
          values: { name: [{ full_name: 'Test' }] }
        }
      });
      await findTool('attio_get_person').handler({ recordId: 'abc-123' });
      assert.ok(lastFetchUrl(mocked).includes('/objects/people/records/abc-123'));
    });
  });

  // ─── Complex input schemas ────────────────────────────────────────────────

  describe('complex input schemas', () => {
    it('attio_update_record sends nested values object', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'r1' } } });
      const values = {
        job_title: [{ value: 'CTO' }],
        email_addresses: [{ email_address: 'new@test.com' }],
        name: [{ first_name: 'Updated', last_name: 'Name' }]
      };
      await findTool('attio_update_record').handler({
        objectType: 'people',
        recordId: 'r1',
        values
      });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values, values);
    });

    it('attio_create_task with linked record sends nested linked_records array', async () => {
      const mocked = mockFetch({ data: { id: { task_id: 't-link' } } });
      await findTool('attio_create_task').handler({
        content: 'Follow up',
        linkedRecordId: 'r1',
        linkedObjectType: 'people',
        deadlineAt: '2026-12-31'
      });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.linked_records, [
        { target_object: 'people', target_record_id: 'r1' }
      ]);
      assert.equal(body.data.deadline_at, '2026-12-31');
      assert.equal(body.data.is_completed, false);
    });

    it('attio_add_note sends content as plain string with format', async () => {
      const mocked = mockFetch({ data: {} });
      await findTool('attio_add_note').handler({
        objectType: 'companies',
        recordId: 'c1',
        title: 'Structured Note',
        content: 'Paragraph text here'
      });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.content, 'Paragraph text here');
      assert.equal(body.data.format, 'plaintext');
      assert.equal(body.data.parent_object, 'companies');
      assert.equal(body.data.parent_record_id, 'c1');
    });

    it('attio_move_deal sends stage as flat status string', async () => {
      const mocked = mockFetch({ data: {} });
      await findTool('attio_move_deal').handler({ recordId: 'd1', stage: 'Negotiation' });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.stage, [{ status: 'Negotiation' }]);
    });
  });

  // ─── Formatting edge cases ────────────────────────────────────────────────

  describe('formatting edge cases', () => {
    it('formatPerson handles record with no values at all', async () => {
      mockFetch({ data: [{ id: { record_id: 'r-empty' }, values: {} }] });
      const result = await findTool('attio_list_people').handler({});
      assert.ok(result.includes('Unknown'));
      assert.ok(result.includes('[id: r-empty]'));
    });

    it('formatCompany handles record with no values', async () => {
      mockFetch({ data: [{ id: { record_id: 'c-empty' }, values: {} }] });
      const result = await findTool('attio_list_companies').handler({});
      assert.ok(result.includes('Unknown'));
      assert.ok(result.includes('[id: c-empty]'));
    });

    it('formatDeal handles deal with no stage and no value', async () => {
      mockFetch({ data: [{ id: { record_id: 'd-bare' }, values: { name: [{ value: 'Bare Deal' }] } }] });
      const result = await findTool('attio_list_deals').handler({});
      assert.ok(result.includes('Bare Deal'));
      assert.ok(!result.includes('undefined'));
    });

    it('attio_list_tasks handles task with no content_plaintext', async () => {
      mockFetch({
        data: [{
          id: { task_id: 't-empty' },
          content_plaintext: null,
          deadline_at: null,
          is_completed: false
        }]
      });
      const result = await findTool('attio_list_tasks').handler({});
      assert.ok(result.includes('No description'));
      assert.ok(result.includes('[id: t-empty]'));
    });

    it('attio_get_person with minimal values returns name and id', async () => {
      mockFetch({
        data: {
          id: { record_id: 'r-min' },
          values: { name: [{ full_name: 'Minimal' }] }
        }
      });
      const result = await findTool('attio_get_person').handler({ recordId: 'r-min' });
      assert.ok(result.includes('Minimal'));
      assert.ok(result.includes('[id: r-min]'));
      // Should not include email/phone/title/description lines
      assert.ok(!result.includes('undefined'));
    });
  });
});
