"""Validate this planning bundle. Does not run the app, inference or network writes."""
import collections
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).parent
ledger = json.loads((root / 'execution-ledger.json').read_text())
source = json.loads((root / 'evidence/issues-snapshot.json').read_text())
expected = {i['number'] for i in source}
assert len(expected) == 20
assert sum(len(i['full_comments']) for i in source) == 14
assert ledger['source_issue_count'] == len(expected)
assert ledger['source_comment_count'] == 14
assert ledger['status'] == 'PLAN_ONLY'
assert not any(ledger['authorizations'].values())
rows = {i['number']: i for i in ledger['issues']}
assert set(rows) == expected and len(rows) == len(ledger['issues'])
sections = [int(x) for x in re.findall(r'^### #(\d+) —', (root/'ISSUE-PACKAGES.md').read_text(), re.M)]
assert set(sections) == expected and len(sections) == len(expected)
by_source = {i['number']: i for i in source}
for n, row in rows.items():
    src = by_source[n]
    assert row['title'] == src['title']
    assert row['comment_count'] == len(src['full_comments'])
    assert row['labels'] == [x['name'] for x in src['labels']]
    assert row['state'] == 'PLANNED' and row['runtime_evidence'] == []
    assert row['acceptance_strategy'] and row['candidate_paths']
packages = {p['id']: p for p in ledger['packages']}
assert len(packages) == len(ledger['packages'])
assert len(packages) == 88
for n, row in rows.items():
    assert row['package_ids']
    assert all(packages[k]['issue'] == n for k in row['package_ids'])
assert {p['issue'] for p in packages.values()} == expected
indegree = {k: len(p['dependencies']) for k,p in packages.items()}
children = collections.defaultdict(list)
for k,p in packages.items():
    assert p['state'] == 'PLANNED' and p['evidence'] == []
    assert p['head_sha'] is None and p['remote_sha'] is None and p['actual_model'] is None
    assert p['requires_independent_review']
    assert p['scope_freeze_required_before_dispatch']
    assert p['ordered_routes'][-1] == 'CODEX'
    assert len(p['ordered_routes']) == len(set(p['ordered_routes']))
    assert all(r in ledger['routes'] for r in p['ordered_routes'])
    assert k not in p['dependencies']
    assert len(p['dependencies']) == len(set(p['dependencies']))
    for dep in p['dependencies']:
        assert dep in packages, (k,dep)
        children[dep].append(k)
ready = collections.deque(k for k,n in indegree.items() if n == 0)
order=[]
while ready:
    k=ready.popleft();order.append(k)
    for c in children[k]:
        indegree[c]-=1
        if indegree[c]==0: ready.append(c)
assert len(order)==len(packages), 'Dependency cycle'
assert ledger['cap_policy']['actual_model_sessions']==2
assert ledger['cap_policy']['route_sessions']==2
assert ledger['cap_policy']['unknown_candidate_set_admissible'] is False
assert ledger['cap_policy']['count_review_and_probes'] is True
assert all(r['cap']==2 for r in ledger['routes'].values())
assert ledger['routes']['CODEX']['availability'].startswith('fallback_only')
assert ledger['orchestrator']['requested_model']=='GLM 5.3 Flash'
assert ledger['orchestrator']['verified'] is False
assert ledger['orchestrator']['zcode_required'] is False
required=['README.md','PLAN.md','ISSUE-PACKAGES.md','WORK-PACKAGES.md','FLEET-PREFLIGHT.md','GLM-HANDOFF.md','execution-ledger.json','evidence/issues-snapshot.json','evidence/issues-full.md','evidence/benchmark-routing-evidence.json','evidence/HARNESS-SCREENING.md']
assert all((root/p).is_file() and (root/p).stat().st_size>0 for p in required)
for name in ['README.md']:
    for href in re.findall(r'\]\(([^)]+)\)',(root/name).read_text()):
        if not href.startswith(('https://','http://','#')):
            assert (root/href.split('#')[0]).exists(), (name,href)
report={'verdict':'PASS','checks':['20 exact source issue IDs covered once','14 source comments reconciled','issue titles/labels/counts preserved literally','88 packages have valid acyclic dependencies','every issue has acceptance and path inventory','every package PLANNED with empty runtime evidence','two-session actual-model/route caps include reviews','every fallback chain terminates at conditional Codex','all deliverables and README relative links exist','no execution/remote-write authorizations fabricated'],'issue_count':len(expected),'comment_count':14,'package_count':len(packages),'dependency_edge_count':sum(len(p['dependencies']) for p in packages.values()),'topological_roots':[k for k,p in packages.items() if not p['dependencies']],'provenance':'Structural planning checks only; no app tests/builds, provider inference, concurrency load test, GitHub mutation or issue completion.'}
text=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
if '--save' in sys.argv:
    (root/'VALIDATION.json').write_text(text)
print(text,end='')
