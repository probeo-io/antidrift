import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import list_people       from '../tools/list_people.mjs';
import search_people     from '../tools/search_people.mjs';
import get_person        from '../tools/get_person.mjs';
import create_person     from '../tools/create_person.mjs';
import list_companies    from '../tools/list_companies.mjs';
import search_companies  from '../tools/search_companies.mjs';
import create_company    from '../tools/create_company.mjs';
import list_deals        from '../tools/list_deals.mjs';
import search_deals      from '../tools/search_deals.mjs';
import create_deal       from '../tools/create_deal.mjs';
import delete_deal       from '../tools/delete_deal.mjs';
import move_deal         from '../tools/move_deal.mjs';
import update_record     from '../tools/update_record.mjs';
import create_task       from '../tools/create_task.mjs';
import list_tasks        from '../tools/list_tasks.mjs';
import complete_task     from '../tools/complete_task.mjs';
import add_note          from '../tools/add_note.mjs';
import search_deals_mod  from '../tools/search_deals.mjs';

// ---------------------------------------------------------------------------
// Mock fetch factory
// ---------------------------------------------------------------------------
function makeFetch(responseData, status = 200) {
  let lastCall = null;
  const fetch = async (url, opts) => {
    lastCall = { url, opts, body: opts?.body ? JSON.parse(opts.body) : undefined };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseData,
      text: async () => JSON.stringify(responseData),
      headers: { get: () => null }
    };
  };
  fetch.last = () => lastCall;
  return fetch;
}

function ctx(fetchOverride) {
  return {
    credentials: { apiKey: 'test-key' },
    fetch: fetchOverride
  };
}

// Fixture factories
function makePerson(id = 'p-1') {
  return { id: { record_id: id }, values: { name: [{ full_name: 'Alice Smith' }], email_addresses: [{ email_address: 'alice@example.com' }] } };
}
function makeCompany(id = 'c-1') {
  return { id: { record_id: id }, values: { name: [{ value: 'Acme Corp' }], domains: [{ domain: 'acme.com' }] } };
}
function makeDeal(id = 'd-1') {
  return { id: { record_id: id }, values: { name: [{ value: 'Big Deal' }], stage: [{ status: { title: 'Qualified' } }], value: [{ currency_value: 5000 }] } };
}

afterEach(() => {});

// ---------------------------------------------------------------------------
// Tool structure
// ---------------------------------------------------------------------------
describe('tool structure', () => {
  const tools = { list_people, search_people, get_person, create_person, list_companies, search_companies, create_company, list_deals, search_deals, create_deal, delete_deal, move_deal, update_record, create_task, list_tasks, complete_task, add_note };
  it('every tool has description, input, execute', () => {
    for (const [name, tool] of Object.entries(tools)) {
      assert.equal(typeof tool.description, 'string', `${name}: description`);
      assert.ok(tool.description.length > 0, `${name}: description non-empty`);
      assert.equal(typeof tool.input, 'object', `${name}: input`);
      assert.equal(typeof tool.execute, 'function', `${name}: execute`);
    }
  });
  it('has 17 tools', () => assert.equal(Object.keys(tools).length, 17));
});

// ---------------------------------------------------------------------------
// list_people
// ---------------------------------------------------------------------------
describe('list_people', () => {
  it('POSTs to /objects/people/records/query with limit', async () => {
    const fetch = makeFetch({ data: [makePerson()] });
    await list_people.execute({ limit: 10 }, ctx(fetch));
    assert.equal(fetch.last().url, 'https://api.attio.com/v2/objects/people/records/query');
    assert.equal(fetch.last().opts.method, 'POST');
    assert.equal(fetch.last().body.limit, 10);
  });
  it('uses default limit 20', async () => {
    const fetch = makeFetch({ data: [] });
    await list_people.execute({}, ctx(fetch));
    assert.equal(fetch.last().body.limit, 20);
  });
  it('returns no-people message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await list_people.execute({}, ctx(fetch));
    assert.ok(result.includes('No people found'));
  });
  it('formats person with name, email, and id', async () => {
    const fetch = makeFetch({ data: [makePerson('p-123')] });
    const result = await list_people.execute({}, ctx(fetch));
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    assert.ok(result.includes('p-123'));
  });
});

// ---------------------------------------------------------------------------
// search_people — v2 filter format
// ---------------------------------------------------------------------------
describe('search_people', () => {
  it('uses v2 $or/$contains filter format', async () => {
    const fetch = makeFetch({ data: [] });
    await search_people.execute({ query: 'alice' }, ctx(fetch));
    const body = fetch.last().body;
    assert.ok(body.filter['$or'], 'must use $or');
    assert.ok(body.filter['$or'][0].name['$contains'], 'name must use $contains');
    assert.equal(body.filter['$or'][0].name['$contains'], 'alice');
    assert.ok(body.filter['$or'][1].email_addresses.email_address['$contains'], 'email must use $contains');
  });
  it('returns no-match message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await search_people.execute({ query: 'nobody' }, ctx(fetch));
    assert.ok(result.includes('No people matching'));
  });
  it('formats results when found', async () => {
    const fetch = makeFetch({ data: [makePerson()] });
    const result = await search_people.execute({ query: 'alice' }, ctx(fetch));
    assert.ok(result.includes('Alice Smith'));
  });
});

// ---------------------------------------------------------------------------
// get_person
// ---------------------------------------------------------------------------
describe('get_person', () => {
  it('GETs /objects/people/records/:id', async () => {
    const fetch = makeFetch({ data: makePerson('p-abc') });
    await get_person.execute({ recordId: 'p-abc' }, ctx(fetch));
    assert.ok(fetch.last().url.endsWith('/objects/people/records/p-abc'));
    assert.equal(fetch.last().opts.method, 'GET');
  });
  it('formats person details', async () => {
    const fetch = makeFetch({ data: makePerson() });
    const result = await get_person.execute({ recordId: 'p-1' }, ctx(fetch));
    assert.ok(result.includes('Alice Smith'));
    assert.ok(result.includes('alice@example.com'));
    assert.ok(result.includes('[id: p-1]'));
  });
});

// ---------------------------------------------------------------------------
// create_person
// ---------------------------------------------------------------------------
describe('create_person', () => {
  it('POSTs to /objects/people/records with correct values structure', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'p-new' } } });
    await create_person.execute({ email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones' }, ctx(fetch));
    const body = fetch.last().body;
    assert.ok(body.data.values, 'must have data.values');
    assert.deepEqual(body.data.values.email_addresses, [{ email_address: 'bob@example.com' }]);
    assert.deepEqual(body.data.values.name, [{ first_name: 'Bob', last_name: 'Jones' }]);
  });
  it('includes job_title when provided', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'p-new' } } });
    await create_person.execute({ email: 'a@b.com', jobTitle: 'CEO' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.values.job_title, [{ value: 'CEO' }]);
  });
  it('omits job_title when not provided', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'p-new' } } });
    await create_person.execute({ email: 'a@b.com' }, ctx(fetch));
    assert.equal(fetch.last().body.data.values.job_title, undefined);
  });
  it('returns success message with record id', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'p-new' } } });
    const result = await create_person.execute({ email: 'a@b.com' }, ctx(fetch));
    assert.ok(result.includes('p-new'));
  });
});

// ---------------------------------------------------------------------------
// list_companies
// ---------------------------------------------------------------------------
describe('list_companies', () => {
  it('POSTs to /objects/companies/records/query with limit', async () => {
    const fetch = makeFetch({ data: [] });
    await list_companies.execute({ limit: 5 }, ctx(fetch));
    assert.ok(fetch.last().url.includes('/objects/companies/records/query'));
    assert.equal(fetch.last().body.limit, 5);
  });
  it('returns no-companies message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await list_companies.execute({}, ctx(fetch));
    assert.ok(result.includes('No companies found'));
  });
  it('formats company with name, domain, and id', async () => {
    const fetch = makeFetch({ data: [makeCompany('c-123')] });
    const result = await list_companies.execute({}, ctx(fetch));
    assert.ok(result.includes('Acme Corp'));
    assert.ok(result.includes('acme.com'));
    assert.ok(result.includes('c-123'));
  });
});

// ---------------------------------------------------------------------------
// search_companies — v2 filter format
// ---------------------------------------------------------------------------
describe('search_companies', () => {
  it('uses v2 $or/$contains filter format', async () => {
    const fetch = makeFetch({ data: [] });
    await search_companies.execute({ query: 'acme' }, ctx(fetch));
    const body = fetch.last().body;
    assert.ok(body.filter['$or']);
    assert.equal(body.filter['$or'][0].name['$contains'], 'acme');
    assert.equal(body.filter['$or'][1].domains.domain['$contains'], 'acme');
  });
  it('returns no-match message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await search_companies.execute({ query: 'none' }, ctx(fetch));
    assert.ok(result.includes('No companies matching'));
  });
});

// ---------------------------------------------------------------------------
// create_company
// ---------------------------------------------------------------------------
describe('create_company', () => {
  it('POSTs with correct values structure', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'c-new' } } });
    await create_company.execute({ name: 'Acme', domain: 'acme.com' }, ctx(fetch));
    const body = fetch.last().body;
    assert.deepEqual(body.data.values.name, [{ value: 'Acme' }]);
    assert.deepEqual(body.data.values.domains, [{ domain: 'acme.com' }]);
  });
  it('omits domain when not provided', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'c-new' } } });
    await create_company.execute({ name: 'Acme' }, ctx(fetch));
    assert.equal(fetch.last().body.data.values.domains, undefined);
  });
});

// ---------------------------------------------------------------------------
// list_deals
// ---------------------------------------------------------------------------
describe('list_deals', () => {
  it('POSTs to /objects/deals/records/query with limit', async () => {
    const fetch = makeFetch({ data: [] });
    await list_deals.execute({ limit: 5 }, ctx(fetch));
    assert.ok(fetch.last().url.includes('/objects/deals/records/query'));
    assert.equal(fetch.last().body.limit, 5);
  });
  it('formats deal with name, stage, value, and id', async () => {
    const fetch = makeFetch({ data: [makeDeal('d-123')] });
    const result = await list_deals.execute({}, ctx(fetch));
    assert.ok(result.includes('Big Deal'));
    assert.ok(result.includes('Qualified'));
    assert.ok(result.includes('5000'));
    assert.ok(result.includes('d-123'));
  });
});

// ---------------------------------------------------------------------------
// search_deals — v2 filter format
// ---------------------------------------------------------------------------
describe('search_deals', () => {
  it('uses v2 $or/$contains filter format', async () => {
    const fetch = makeFetch({ data: [] });
    await search_deals.execute({ query: 'big' }, ctx(fetch));
    const body = fetch.last().body;
    assert.ok(body.filter['$or']);
    assert.equal(body.filter['$or'][0].name['$contains'], 'big');
    assert.ok(body.filter['$or'][1].stage.status['$contains'], 'stage must use status.$contains');
  });
  it('returns no-match message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await search_deals.execute({ query: 'none' }, ctx(fetch));
    assert.ok(result.includes('No deals matching'));
  });
});

// ---------------------------------------------------------------------------
// create_deal
// ---------------------------------------------------------------------------
describe('create_deal', () => {
  it('POSTs with name in correct values structure', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'd-new' } } });
    await create_deal.execute({ name: 'New Deal' }, ctx(fetch));
    const body = fetch.last().body;
    assert.deepEqual(body.data.values.name, [{ value: 'New Deal' }]);
  });
  it('sets stage as flat status string', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'd-new' } } });
    await create_deal.execute({ name: 'Deal', stage: 'Qualified' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.values.stage, [{ status: 'Qualified' }]);
  });
  it('sets owner as workspace_member_email_address', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'd-new' } } });
    await create_deal.execute({ name: 'Deal', owner: 'chris@example.com' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.values.owner, [{ workspace_member_email_address: 'chris@example.com' }]);
  });
  it('omits owner when not provided', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'd-new' } } });
    await create_deal.execute({ name: 'Deal' }, ctx(fetch));
    assert.equal(fetch.last().body.data.values.owner, undefined);
  });
  it('sets value and associated_company', async () => {
    const fetch = makeFetch({ data: { id: { record_id: 'd-new' } } });
    await create_deal.execute({ name: 'Deal', value: 5000, linkedCompanyId: 'c-1' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.values.value, [{ currency_value: 5000 }]);
    assert.deepEqual(fetch.last().body.data.values.associated_company, [{ target_object: 'companies', target_record_id: 'c-1' }]);
  });
});

// ---------------------------------------------------------------------------
// delete_deal
// ---------------------------------------------------------------------------
describe('delete_deal', () => {
  it('DELETEs /objects/deals/records/:id', async () => {
    const fetch = makeFetch({});
    await delete_deal.execute({ recordId: 'd-del' }, ctx(fetch));
    assert.ok(fetch.last().url.endsWith('/objects/deals/records/d-del'));
    assert.equal(fetch.last().opts.method, 'DELETE');
  });
  it('returns success message', async () => {
    const fetch = makeFetch({});
    const result = await delete_deal.execute({ recordId: 'd-del' }, ctx(fetch));
    assert.ok(result.includes('d-del'));
  });
});

// ---------------------------------------------------------------------------
// move_deal
// ---------------------------------------------------------------------------
describe('move_deal', () => {
  it('PATCHes /objects/deals/records/:id with flat status string', async () => {
    const fetch = makeFetch({ data: {} });
    await move_deal.execute({ recordId: 'd-1', stage: 'Closed Won' }, ctx(fetch));
    assert.ok(fetch.last().url.endsWith('/objects/deals/records/d-1'));
    assert.equal(fetch.last().opts.method, 'PATCH');
    assert.deepEqual(fetch.last().body.data.values.stage, [{ status: 'Closed Won' }]);
  });
});

// ---------------------------------------------------------------------------
// update_record
// ---------------------------------------------------------------------------
describe('update_record', () => {
  it('PATCHes /objects/:type/records/:id with values', async () => {
    const fetch = makeFetch({ data: {} });
    await update_record.execute({ objectType: 'people', recordId: 'p-1', values: { job_title: [{ value: 'CTO' }] } }, ctx(fetch));
    assert.ok(fetch.last().url.includes('/objects/people/records/p-1'));
    assert.equal(fetch.last().opts.method, 'PATCH');
    assert.deepEqual(fetch.last().body.data.values.job_title, [{ value: 'CTO' }]);
  });
});

// ---------------------------------------------------------------------------
// create_task — all required fields per Attio API
// ---------------------------------------------------------------------------
describe('create_task', () => {
  it('POSTs to /tasks with all required fields', async () => {
    const fetch = makeFetch({ data: { id: { task_id: 't-new' } } });
    await create_task.execute({ content: 'Follow up' }, ctx(fetch));
    const body = fetch.last().body.data;
    assert.equal(body.content, 'Follow up');
    assert.equal(body.format, 'plaintext');
    assert.equal(body.is_completed, false);
    assert.equal(body.deadline_at, null);
    assert.deepEqual(body.linked_records, []);
    assert.deepEqual(body.assignees, []);
  });
  it('sets deadline_at when provided', async () => {
    const fetch = makeFetch({ data: { id: { task_id: 't-new' } } });
    await create_task.execute({ content: 'Task', deadlineAt: '2026-05-01T00:00:00.000Z' }, ctx(fetch));
    assert.equal(fetch.last().body.data.deadline_at, '2026-05-01T00:00:00.000Z');
  });
  it('sets assignees as referenced_actor objects', async () => {
    const fetch = makeFetch({ data: { id: { task_id: 't-new' } } });
    await create_task.execute({ content: 'Task', assignees: 'uuid-1,uuid-2' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.assignees, [
      { referenced_actor_type: 'workspace-member', referenced_actor_id: 'uuid-1' },
      { referenced_actor_type: 'workspace-member', referenced_actor_id: 'uuid-2' }
    ]);
  });
  it('sets linked_records when record and type provided', async () => {
    const fetch = makeFetch({ data: { id: { task_id: 't-new' } } });
    await create_task.execute({ content: 'Task', linkedRecordId: 'p-1', linkedObjectType: 'people' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.linked_records, [{ target_object: 'people', target_record_id: 'p-1' }]);
  });
  it('returns empty linked_records when no link provided', async () => {
    const fetch = makeFetch({ data: { id: { task_id: 't-new' } } });
    await create_task.execute({ content: 'Task' }, ctx(fetch));
    assert.deepEqual(fetch.last().body.data.linked_records, []);
  });
});

// ---------------------------------------------------------------------------
// list_tasks
// ---------------------------------------------------------------------------
describe('list_tasks', () => {
  it('GETs /tasks with limit', async () => {
    const fetch = makeFetch({ data: [] });
    await list_tasks.execute({ limit: 5 }, ctx(fetch));
    assert.ok(fetch.last().url.includes('/tasks?limit=5'));
    assert.equal(fetch.last().opts.method, 'GET');
  });
  it('returns no-tasks message when empty', async () => {
    const fetch = makeFetch({ data: [] });
    const result = await list_tasks.execute({}, ctx(fetch));
    assert.ok(result.includes('No tasks found'));
  });
  it('formats task with status, content, and id', async () => {
    const fetch = makeFetch({ data: [{ id: { task_id: 't-1' }, is_completed: false, content_plaintext: 'Call Alice' }] });
    const result = await list_tasks.execute({}, ctx(fetch));
    assert.ok(result.includes('Call Alice'));
    assert.ok(result.includes('t-1'));
  });
});

// ---------------------------------------------------------------------------
// complete_task
// ---------------------------------------------------------------------------
describe('complete_task', () => {
  it('PATCHes /tasks/:id with is_completed: true', async () => {
    const fetch = makeFetch({});
    await complete_task.execute({ taskId: 't-1' }, ctx(fetch));
    assert.ok(fetch.last().url.endsWith('/tasks/t-1'));
    assert.equal(fetch.last().opts.method, 'PATCH');
    assert.equal(fetch.last().body.data.is_completed, true);
  });
});

// ---------------------------------------------------------------------------
// add_note — content as string, format required
// ---------------------------------------------------------------------------
describe('add_note', () => {
  it('POSTs to /notes with correct structure', async () => {
    const fetch = makeFetch({ data: { id: { note_id: 'n-1' } } });
    await add_note.execute({ objectType: 'people', recordId: 'p-1', title: 'Meeting', content: 'Great call' }, ctx(fetch));
    const body = fetch.last().body.data;
    assert.equal(body.title, 'Meeting');
    assert.equal(body.content, 'Great call');
    assert.equal(body.format, 'plaintext');
    assert.equal(body.parent_object, 'people');
    assert.equal(body.parent_record_id, 'p-1');
  });
  it('uses "companies" for company notes', async () => {
    const fetch = makeFetch({ data: { id: { note_id: 'n-1' } } });
    await add_note.execute({ objectType: 'companies', recordId: 'c-1', title: 'Note', content: 'Text' }, ctx(fetch));
    assert.equal(fetch.last().body.data.parent_object, 'companies');
  });
  it('content is a plain string, not rich text', async () => {
    const fetch = makeFetch({ data: { id: { note_id: 'n-1' } } });
    await add_note.execute({ objectType: 'people', recordId: 'p-1', title: 'T', content: 'Hello world' }, ctx(fetch));
    assert.equal(typeof fetch.last().body.data.content, 'string');
  });
});
