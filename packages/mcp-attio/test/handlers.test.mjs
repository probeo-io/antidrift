import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.antidrift');
const CONFIG_PATH = join(CONFIG_DIR, 'attio.json');
const BACKUP_PATH = CONFIG_PATH + '.handler-test-backup';

let tools;
let findTool;

// --- Fixtures ---

const PERSON_RECORD = {
  id: { record_id: 'r1' },
  values: {
    name: [{ full_name: 'John Doe', first_name: 'John', last_name: 'Doe' }],
    email_addresses: [{ email_address: 'john@test.com' }]
  }
};

const PERSON_RECORD_2 = {
  id: { record_id: 'r2' },
  values: {
    name: [{ full_name: 'Jane Smith', first_name: 'Jane', last_name: 'Smith' }],
    email_addresses: [{ email_address: 'jane@test.com' }]
  }
};

const COMPANY_RECORD = {
  id: { record_id: 'c1' },
  values: {
    name: [{ value: 'Acme Corp' }],
    domains: [{ domain: 'acme.com' }]
  }
};

const DEAL_RECORD = {
  id: { record_id: 'd1' },
  values: {
    name: [{ value: 'Big Deal' }],
    stage: [{ status: { title: 'Proposal' } }],
    value: [{ currency_value: 50000 }]
  }
};

const TASK_RECORD = {
  id: { task_id: 't1' },
  content_plaintext: 'Follow up with client',
  deadline_at: '2026-04-01T00:00:00Z',
  is_completed: false
};

const TASK_RECORD_COMPLETED = {
  id: { task_id: 't2' },
  content_plaintext: 'Send proposal',
  deadline_at: null,
  is_completed: true
};

// --- Setup / Teardown ---

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

function lastFetchCall(mockedFetch) {
  const calls = mockedFetch.mock.calls;
  return calls[calls.length - 1];
}

function lastFetchUrl(mockedFetch) {
  return lastFetchCall(mockedFetch).arguments[0];
}

function lastFetchOpts(mockedFetch) {
  return lastFetchCall(mockedFetch).arguments[1];
}

function lastFetchBody(mockedFetch) {
  const opts = lastFetchOpts(mockedFetch);
  return opts.body ? JSON.parse(opts.body) : undefined;
}

// --- Tests ---

describe('attio handler tests', () => {

  // 1. attio_list_people
  describe('attio_list_people', () => {
    it('returns formatted people list', async () => {
      const mocked = mockFetch({ data: [PERSON_RECORD, PERSON_RECORD_2] });
      const handler = findTool('attio_list_people').handler;
      const result = await handler({ limit: 20 });

      assert.ok(result.includes('John Doe'));
      assert.ok(result.includes('john@test.com'));
      assert.ok(result.includes('Jane Smith'));
      assert.ok(result.includes('[id: r1]'));
      assert.ok(result.includes('[id: r2]'));
    });

    it('sends POST to /objects/people/records/query with limit', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_people').handler({ limit: 5 });

      assert.ok(lastFetchUrl(mocked).endsWith('/objects/people/records/query'));
      assert.equal(lastFetchOpts(mocked).method, 'POST');
      assert.deepEqual(lastFetchBody(mocked), { limit: 5 });
    });

    it('returns empty message when no people found', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_people').handler({});
      assert.equal(result, 'No people found.');
    });

    it('sends Authorization header with Bearer token', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_people').handler({});
      assert.equal(lastFetchOpts(mocked).headers['Authorization'], 'Bearer test-fake-key');
    });
  });

  // 2. attio_search_people
  describe('attio_search_people', () => {
    it('sends filter with or conditions for name and email', async () => {
      const mocked = mockFetch({ data: [PERSON_RECORD] });
      const result = await findTool('attio_search_people').handler({ query: 'John' });

      const body = lastFetchBody(mocked);
      assert.ok(body.filter);
      assert.ok(body.filter.or);
      assert.equal(body.filter.or.length, 2);
      assert.equal(body.filter.or[0].attribute, 'name');
      assert.equal(body.filter.or[0].value, 'John');
      assert.equal(body.filter.or[1].attribute, 'email_addresses');
      assert.ok(result.includes('John Doe'));
    });

    it('returns no-match message when empty', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_search_people').handler({ query: 'Nobody' });
      assert.ok(result.includes('No people matching'));
      assert.ok(result.includes('Nobody'));
    });
  });

  // 3. attio_create_person
  describe('attio_create_person', () => {
    it('sends email, firstName, lastName in correct structure', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'new-r1' }, values: {} } });
      const result = await findTool('attio_create_person').handler({
        email: 'alice@test.com',
        firstName: 'Alice',
        lastName: 'Jones'
      });

      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.email_addresses, [{ email_address: 'alice@test.com' }]);
      assert.deepEqual(body.data.values.name, [{ first_name: 'Alice', last_name: 'Jones' }]);
      assert.ok(lastFetchUrl(mocked).endsWith('/objects/people/records'));
      assert.equal(lastFetchOpts(mocked).method, 'POST');
      assert.ok(result.includes('Created'));
      assert.ok(result.includes('Alice'));
      assert.ok(result.includes('new-r1'));
    });

    it('sends jobTitle when provided', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'new-r2' }, values: {} } });
      await findTool('attio_create_person').handler({
        email: 'bob@test.com',
        firstName: 'Bob',
        jobTitle: 'CTO'
      });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.job_title, [{ value: 'CTO' }]);
    });

    it('omits name when neither firstName nor lastName given', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'new-r3' }, values: {} } });
      await findTool('attio_create_person').handler({ email: 'anon@test.com' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.name, undefined);
    });
  });

  // 4. attio_list_companies
  describe('attio_list_companies', () => {
    it('returns formatted company list with names and domains', async () => {
      mockFetch({ data: [COMPANY_RECORD] });
      const result = await findTool('attio_list_companies').handler({});

      assert.ok(result.includes('Acme Corp'));
      assert.ok(result.includes('acme.com'));
      assert.ok(result.includes('[id: c1]'));
    });

    it('returns empty message when no companies found', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_companies').handler({});
      assert.equal(result, 'No companies found.');
    });
  });

  // 5. attio_search_companies
  describe('attio_search_companies', () => {
    it('sends filter with name and domains conditions', async () => {
      const mocked = mockFetch({ data: [COMPANY_RECORD] });
      const result = await findTool('attio_search_companies').handler({ query: 'Acme' });

      const body = lastFetchBody(mocked);
      assert.ok(body.filter.or);
      assert.equal(body.filter.or[0].attribute, 'name');
      assert.equal(body.filter.or[0].value, 'Acme');
      assert.equal(body.filter.or[1].attribute, 'domains');
      assert.ok(result.includes('Acme Corp'));
    });

    it('returns no-match message when empty', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_search_companies').handler({ query: 'ZZZ' });
      assert.ok(result.includes('No companies matching'));
    });
  });

  // 6. attio_create_company
  describe('attio_create_company', () => {
    it('sends name and domain in correct structure', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'new-c1' }, values: {} } });
      const result = await findTool('attio_create_company').handler({
        name: 'Newco',
        domain: 'newco.io'
      });

      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.name, [{ value: 'Newco' }]);
      assert.deepEqual(body.data.values.domains, [{ domain: 'newco.io' }]);
      assert.ok(result.includes('Created'));
      assert.ok(result.includes('Newco'));
      assert.ok(result.includes('new-c1'));
    });

    it('omits domains when not provided', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'new-c2' }, values: {} } });
      await findTool('attio_create_company').handler({ name: 'NoDomain Inc' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.values.domains, undefined);
    });
  });

  // 7. attio_list_deals
  describe('attio_list_deals', () => {
    it('returns formatted deal list with name, stage, and value', async () => {
      mockFetch({ data: [DEAL_RECORD] });
      const result = await findTool('attio_list_deals').handler({});

      assert.ok(result.includes('Big Deal'));
      assert.ok(result.includes('Proposal'));
      assert.ok(result.includes('50000'));
      assert.ok(result.includes('[id: d1]'));
    });

    it('returns empty message when no deals found', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_deals').handler({});
      assert.equal(result, 'No deals found.');
    });
  });

  // 8. attio_update_record
  describe('attio_update_record', () => {
    it('sends PATCH to correct endpoint with values', async () => {
      const mocked = mockFetch({ data: { id: { record_id: 'r1' } } });
      const values = { job_title: [{ value: 'CTO' }] };
      const result = await findTool('attio_update_record').handler({
        objectType: 'people',
        recordId: 'r1',
        values
      });

      assert.ok(lastFetchUrl(mocked).endsWith('/objects/people/records/r1'));
      assert.equal(lastFetchOpts(mocked).method, 'PATCH');
      assert.deepEqual(lastFetchBody(mocked), { data: { values } });
      assert.ok(result.includes('Updated'));
      assert.ok(result.includes('people'));
      assert.ok(result.includes('r1'));
    });

    it('works for companies objectType', async () => {
      const mocked = mockFetch({ data: {} });
      await findTool('attio_update_record').handler({
        objectType: 'companies',
        recordId: 'c1',
        values: { name: [{ value: 'New Name' }] }
      });
      assert.ok(lastFetchUrl(mocked).includes('/objects/companies/records/c1'));
    });
  });

  // 9. attio_move_deal
  describe('attio_move_deal', () => {
    it('sends PATCH with stage value to deals endpoint', async () => {
      const mocked = mockFetch({ data: {} });
      const result = await findTool('attio_move_deal').handler({
        recordId: 'd1',
        stage: 'Closed Won'
      });

      assert.ok(lastFetchUrl(mocked).endsWith('/objects/deals/records/d1'));
      assert.equal(lastFetchOpts(mocked).method, 'PATCH');
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.values.stage, [{ status: 'Closed Won' }]);
      assert.ok(result.includes('Closed Won'));
    });
  });

  // 10. attio_create_task
  describe('attio_create_task', () => {
    it('sends content and deadline in correct structure', async () => {
      const mocked = mockFetch({ data: { id: { task_id: 'new-t1' } } });
      const result = await findTool('attio_create_task').handler({
        content: 'Call client',
        deadlineAt: '2026-05-01'
      });

      const body = lastFetchBody(mocked);
      assert.ok(lastFetchUrl(mocked).endsWith('/tasks'));
      assert.equal(lastFetchOpts(mocked).method, 'POST');
      assert.deepEqual(body.data.content, [{ type: 'paragraph', children: [{ text: 'Call client' }] }]);
      assert.equal(body.data.deadline_at, '2026-05-01');
      assert.equal(body.data.is_completed, false);
      assert.ok(result.includes('Call client'));
      assert.ok(result.includes('2026-05-01'));
    });

    it('omits deadline when not provided', async () => {
      const mocked = mockFetch({ data: { id: { task_id: 'new-t2' } } });
      await findTool('attio_create_task').handler({ content: 'Quick task' });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.deadline_at, undefined);
    });

    it('includes linked record when provided', async () => {
      const mocked = mockFetch({ data: { id: { task_id: 'new-t3' } } });
      await findTool('attio_create_task').handler({
        content: 'Follow up',
        linkedRecordId: 'r1',
        linkedObjectType: 'people'
      });
      const body = lastFetchBody(mocked);
      assert.deepEqual(body.data.linked_records, [
        { target_object: 'people', target_record_id: 'r1' }
      ]);
    });
  });

  // 11. attio_list_tasks
  describe('attio_list_tasks', () => {
    it('returns formatted task list with status and deadline', async () => {
      mockFetch({ data: [TASK_RECORD, TASK_RECORD_COMPLETED] });
      const result = await findTool('attio_list_tasks').handler({});

      assert.ok(result.includes('Follow up with client'));
      assert.ok(result.includes('[id: t1]'));
      assert.ok(result.includes('Send proposal'));
      assert.ok(result.includes('[id: t2]'));
      // Incomplete task uses empty box
      assert.ok(result.includes('\u2B1C'));
      // Completed task uses checkmark
      assert.ok(result.includes('\u2705'));
    });

    it('sends GET with limit query parameter', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_tasks').handler({ limit: 10 });
      assert.ok(lastFetchUrl(mocked).includes('/tasks?limit=10'));
      assert.equal(lastFetchOpts(mocked).method, 'GET');
    });

    it('returns empty message when no tasks found', async () => {
      mockFetch({ data: [] });
      const result = await findTool('attio_list_tasks').handler({});
      assert.equal(result, 'No tasks found.');
    });
  });

  // 12. attio_complete_task
  describe('attio_complete_task', () => {
    it('sends PATCH with is_completed: true', async () => {
      const mocked = mockFetch({ data: {} });
      const result = await findTool('attio_complete_task').handler({ taskId: 't1' });

      assert.ok(lastFetchUrl(mocked).endsWith('/tasks/t1'));
      assert.equal(lastFetchOpts(mocked).method, 'PATCH');
      const body = lastFetchBody(mocked);
      assert.equal(body.data.is_completed, true);
      assert.ok(result.includes('completed'));
    });
  });

  // 13. attio_add_note
  describe('attio_add_note', () => {
    it('sends note with title, content, and parent record', async () => {
      const mocked = mockFetch({ data: { id: { note_id: 'n1' } } });
      const result = await findTool('attio_add_note').handler({
        objectType: 'people',
        recordId: 'r1',
        title: 'Meeting Notes',
        content: 'Discussed roadmap'
      });

      assert.ok(lastFetchUrl(mocked).endsWith('/notes'));
      assert.equal(lastFetchOpts(mocked).method, 'POST');
      const body = lastFetchBody(mocked);
      assert.equal(body.data.title, 'Meeting Notes');
      assert.deepEqual(body.data.content, [{ type: 'paragraph', children: [{ text: 'Discussed roadmap' }] }]);
      assert.equal(body.data.parent_object, 'people');
      assert.equal(body.data.parent_record_id, 'r1');
      assert.ok(result.includes('Meeting Notes'));
    });

    it('sets parent_object to companies for company notes', async () => {
      const mocked = mockFetch({ data: {} });
      await findTool('attio_add_note').handler({
        objectType: 'companies',
        recordId: 'c1',
        title: 'Note',
        content: 'Content'
      });
      const body = lastFetchBody(mocked);
      assert.equal(body.data.parent_object, 'companies');
    });
  });

  // 14. Error: 401 Unauthorized
  describe('error handling', () => {
    it('throws on 401 unauthorized with status in message', async () => {
      mockFetch({ error: 'Unauthorized' }, 401);
      await assert.rejects(
        () => findTool('attio_list_people').handler({}),
        (err) => {
          assert.ok(err.message.includes('401'));
          return true;
        }
      );
    });

    // 15. Error: 404 Not Found
    it('throws on 404 not found with status in message', async () => {
      mockFetch({ error: 'Not Found' }, 404);
      await assert.rejects(
        () => findTool('attio_list_companies').handler({}),
        (err) => {
          assert.ok(err.message.includes('404'));
          return true;
        }
      );
    });

    it('throws on 500 server error', async () => {
      mockFetch({ error: 'Internal Server Error' }, 500);
      await assert.rejects(
        () => findTool('attio_list_deals').handler({}),
        (err) => {
          assert.ok(err.message.includes('500'));
          return true;
        }
      );
    });

    it('includes error body text from API response', async () => {
      mockFetch({ message: 'Invalid API key' }, 403);
      await assert.rejects(
        () => findTool('attio_search_people').handler({ query: 'test' }),
        (err) => {
          assert.ok(err.message.includes('Invalid API key'));
          return true;
        }
      );
    });
  });

  // Additional edge case tests
  describe('edge cases', () => {
    it('attio_get_person returns full details with all fields', async () => {
      mockFetch({
        data: {
          id: { record_id: 'r1' },
          values: {
            name: [{ full_name: 'John Doe' }],
            email_addresses: [{ email_address: 'john@test.com' }, { email_address: 'jd@work.com' }],
            phone_numbers: [{ phone_number: '+1234567890' }],
            job_title: [{ value: 'Engineer' }],
            description: [{ value: 'Great person' }]
          }
        }
      });
      const result = await findTool('attio_get_person').handler({ recordId: 'r1' });

      assert.ok(result.includes('John Doe'));
      assert.ok(result.includes('john@test.com'));
      assert.ok(result.includes('jd@work.com'));
      assert.ok(result.includes('+1234567890'));
      assert.ok(result.includes('Engineer'));
      assert.ok(result.includes('Great person'));
      assert.ok(result.includes('[id: r1]'));
    });

    it('attio_list_people uses default limit of 20', async () => {
      const mocked = mockFetch({ data: [] });
      await findTool('attio_list_people').handler({});
      const body = lastFetchBody(mocked);
      assert.equal(body.limit, 20);
    });

    it('formatPerson handles missing email gracefully', async () => {
      mockFetch({
        data: [{
          id: { record_id: 'r-no-email' },
          values: { name: [{ full_name: 'No Email Person' }] }
        }]
      });
      const result = await findTool('attio_list_people').handler({});
      assert.ok(result.includes('No Email Person'));
      assert.ok(result.includes('[id: r-no-email]'));
    });

    it('formatCompany handles missing domain gracefully', async () => {
      mockFetch({
        data: [{
          id: { record_id: 'c-no-domain' },
          values: { name: [{ value: 'Mystery Co' }] }
        }]
      });
      const result = await findTool('attio_list_companies').handler({});
      assert.ok(result.includes('Mystery Co'));
      assert.ok(!result.includes('undefined'));
    });
  });
});
