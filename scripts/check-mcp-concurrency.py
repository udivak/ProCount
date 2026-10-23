#!/usr/bin/env python3
"""Run two overlapping DB writes via Supabase CLI; delete only this test's rows."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
import subprocess
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project-ref', required=True)
parser.add_argument('--user-id', type=uuid.UUID, required=True)
parser.add_argument('--client-id', type=uuid.UUID, required=True)
args = parser.parse_args()
request_id = str(uuid.uuid4())
user_id, client_id = str(args.user_id), str(args.client_id)

def query(sql):
    result = subprocess.run(['supabase', 'db', 'query', '--linked', '--project-ref', args.project_ref, sql],
                            capture_output=True, text=True, timeout=120, check=True)
    return json.loads(result.stdout)['rows']

claims = json.dumps({'sub': user_id, 'role': 'authenticated', 'client_id': client_id})
# Give both independent CLI connections time to authenticate before the barrier.
barrier = time.time() + 45
sql = f"""begin;
set local statement_timeout='90s';
select set_config('request.jwt.claims','{claims}',true);
select pg_sleep(greatest(0,{barrier}-extract(epoch from clock_timestamp())));
set local role authenticated;
select clock_timestamp() as started,
public.connector_write('{request_id}','water',jsonb_build_object('date',(now() at time zone 'Asia/Jerusalem')::date,'water_ml',1)) as result,
pg_sleep(5),clock_timestamp() as finished;
commit;"""
predicate = f"user_id='{user_id}' and client_id='{client_id}' and request_id='{request_id}'"
entry_ids = []
try:
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(query, sql) for _ in range(2)]
        rows = [future.result()[0] for future in futures]
    entry_ids = list({row['result']['entry']['id'] for row in rows})
    assert len(entry_ids) == 1, 'concurrent requests created different entries'
    starts = [datetime.fromisoformat(row['started']) for row in rows]
    ends = [datetime.fromisoformat(row['finished']) for row in rows]
    assert max(starts) < min(ends), 'connections did not actually overlap'
    counts = query(f"select count(*) as requests, count(distinct e.id) as entries from private.connector_requests r join public.entries e on e.id=(r.result->'entry'->>'id')::uuid where r.user_id='{user_id}' and r.client_id='{client_id}' and r.request_id='{request_id}';")[0]
    assert counts == {'requests': 1, 'entries': 1}, counts
    print(json.dumps({'status': 'PASS', 'request_id': request_id, 'overlap_seconds': (min(ends)-max(starts)).total_seconds(), **counts}), flush=True)
finally:
    # The audit result identifies the exact test entry even if a CLI response was lost.
    cleanup = query(f"""begin;
delete from public.entries where user_id='{user_id}' and id in
(select (result->'entry'->>'id')::uuid from private.connector_requests where {predicate});
delete from private.connector_requests where {predicate};
commit;
select count(*) as remaining_test_requests from private.connector_requests where {predicate};""")
    assert cleanup[0]['remaining_test_requests'] == 0, cleanup
    if entry_ids:
        remaining = query("select count(*) as remaining_test_entries from public.entries where id in (" + ','.join("'"+str(uuid.UUID(entry_id))+"'" for entry_id in entry_ids) + ");")[0]
        assert remaining['remaining_test_entries'] == 0, remaining
    print('PASS: test entry and request cleaned', flush=True)
