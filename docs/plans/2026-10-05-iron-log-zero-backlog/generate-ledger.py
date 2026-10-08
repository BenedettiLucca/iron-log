"""Generate planning artifacts from the frozen real issue snapshot, not execution results."""
import datetime
import json
import pathlib
import re

root = pathlib.Path(__file__).parent
repo = root.parents[2]
snapshot = json.loads((root / 'evidence/issues-snapshot.json').read_text())
appendix = (root / 'ISSUE-PACKAGES.md').read_text()
sections = {int(m.group(1)): m.group(2) for m in re.finditer(r'^### #(\d+) — [^\n]+\n(.*?)(?=^### #|^## 4\.|\Z)', appendix, re.M | re.S)}
classes = {64:'C',66:'U',67:'T',70:'U',72:'R',74:'T',75:'R',79:'C',80:'C',81:'C',82:'C',95:'C',112:'N',114:'N',136:'T',147:'C',148:'T',149:'T',150:'T',151:'T'}
routes = {
    'AGY-G': {'harness':'agy','requested_model':'Gemini 3.8 Flash','selector':'gemini-3.8-flash-high','cap':2,'availability':'catalog_verified_inference_unchecked'},
    'AGY-S': {'harness':'agy','requested_model':'Claude Sonnet 5.5','selector':'claude-sonnet-5-5-high','cap':2,'availability':'parent_catalog_verified_high_not_max_inference_unchecked'},
    'OMP': {'harness':'omp','requested_model':'oc-executor-free (Agnes 3.0 Flash / Grok 4.6)','selector':'omniroute/oc-executor-free','cap':2,'availability':'combo_requires_roster_restriction_and_identity_cap_guard'},
    'OC-M': {'harness':'opencode','requested_model':'MiMo V2.6 Flash','selector':None,'cap':2,'availability':'identity_unresolved_empty_catalog'},
    'CLINE': {'harness':'cline','requested_model':'DeepSeek V4.1 Flash','selector':'cline-free/deepseek-v4.1-flash','cap':2,'availability':'config_verified_xhigh_inference_unchecked'},
    'CURSOR': {'harness':'cursor-agent','requested_model':'auto','selector':'auto','cap':2,'availability':'actual_model_unresolved'},
    'CODEX': {'harness':'codex','requested_model':'GPT 5.6 Luna max','selector':'gpt-5.6-luna','effort':'max','cap':2,'availability':'fallback_only_config_verified_inference_unchecked'},
}
preferences = {
    'C':['AGY-G','AGY-S','OMP','CLINE','OC-M','CURSOR','CODEX'],
    'R':['AGY-S','AGY-G','CLINE','OMP','OC-M','CURSOR','CODEX'],
    'T':['OMP','OC-M','CLINE','AGY-G','AGY-S','CURSOR','CODEX'],
    'U':['AGY-G','CLINE','OC-M','OMP','AGY-S','CURSOR','CODEX'],
    'N':['AGY-G','CLINE','AGY-S','OMP','CURSOR','OC-M','CODEX'],
}
decisions = {64:['archive_selection'],66:['D6'],67:['D1','D2'],70:['D10'],72:['D9','D10'],74:['plateau_comparison'],75:['D9'],79:['D4','D5'],80:['D4'],81:['D4','D5'],82:['D7'],95:['D1'],112:['D11'],114:[],136:['D8'],147:['D3'],148:['D12'],149:[],150:[],151:[]}
schema = {64,66,67,79,81,82,95,136,147}
phases = {i['number']: ['contract'] + (['schema'] if i['number'] in schema else []) + ['core','wiring'] + (['native'] if i['number'] != 151 else []) for i in snapshot}
external_deps = {
    (147,'core'):['151-core'], (148,'wiring'):['151-core','147-contract'],
    (149,'core'):['147-core','148-wiring','151-core'],
    (80,'core'):['81-core'], (79,'core'):['81-core'], (79,'schema'):['81-schema'],
    (66,'wiring'):['81-core'], (82,'wiring'):['81-core'], (67,'core'):['95-core'],
    (75,'core'):['74-core','147-core'], (114,'core'):['112-native'],
    (136,'wiring'):['149-wiring','82-wiring'], (114,'native'):['80-wiring'],
}

def expand_braces(path):
    m = re.search(r'\{([^{}]+)\}', path)
    return [p for s in m.group(1).split(',') for p in expand_braces(path[:m.start()]+s+path[m.end():])] if m else [path]

issues, packages = [], []
for src in snapshot:
    n = src['number']
    sec = sections[n]
    paths_line = next(line for line in sec.splitlines() if line.startswith('- **Paths:**'))
    paths = sorted({p for q in re.findall(r'`([^`]+)`', paths_line) if '/' in q and not q.startswith('http') and ' ' not in q for p in expand_braces(q)})
    candidates = [{'path':p,'kind':('pattern_or_generated' if '*' in p or '<' in p else 'existing' if (repo/p).exists() else 'proposed_new_or_to_confirm')} for p in paths]
    row = {'number':n,'title':src['title'],'url':src['html_url'],'source_state':src['state'],'updated_at':src['updated_at'],'labels':[x['name'] for x in src['labels']],'comment_count':len(src['full_comments']),'state':'PLANNED','task_class':classes[n],'ordered_routes':preferences[classes[n]],'owner_decisions':decisions[n],'section':'ISSUE-PACKAGES.md','candidate_paths':candidates,'acceptance_strategy':[line.removeprefix('- ') for line in sec.splitlines() if line.startswith('- **Acceptance')],'original_acceptance_source':'evidence/issues-snapshot.json','runtime_evidence':[],'package_ids':[]}
    for idx, phase in enumerate(phases[n]):
        pid = f'{n}-{phase}'
        row['package_ids'].append(pid)
        deps = ([f'{n}-{phases[n][idx-1]}'] if idx else []) + external_deps.get((n,phase),[])
        if phase == 'contract':
            locks=[]
            goal='Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.'
        elif phase == 'schema':
            locks=['SCHEMA']
            goal='Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.'
        elif phase == 'core':
            locks=[]
            goal='Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.'
        elif phase == 'wiring':
            locks=[]
            if n in {66,79,80,81,82,150}: locks += ['SESSION']
            if n in {147,148,149,136,82,66}: locks += ['EXPORT']
            if n in {64,67,70,72,95,80}: locks += ['HOME_HISTORY']
            if n in {67,95}: locks += ['SCHEDULE']
            if n in {70,72}: locks += ['HEALTH_CLIENT']
            if n == 112: locks += ['PLATFORM']
            if n != 150: locks += ['I18N']
            goal='Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.'
        else:
            locks=['ANDROID_QA']
            goal='Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.'
        cls = 'N' if phase == 'native' else ('R' if phase == 'contract' and n in {72,75,147} else classes[n])
        blockers=[] if phase=='contract' else ['owner:'+d for d in decisions[n]]
        if n in {70,72} and phase in {'wiring','native'}: blockers.append('external:verified_authorized_Alexandria_contract_and_live_data')
        packages.append({'id':pid,'issue':n,'phase':phase,'state':'PLANNED','goal':goal,'dependencies':sorted(set(deps)),'route_class':cls,'ordered_routes':preferences[cls],'locks':sorted(set(locks)),'blocker_requirements':blockers,'requires_independent_review':True,'review_findings_required':[],'scope_freeze_required_before_dispatch':True,'actual_model':None,'head_sha':None,'remote_sha':None,'evidence':[]})
    issues.append(row)
ledger = {'schema_version':1,'status':'PLAN_ONLY','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repo':'BenedettiLucca/iron-log','base_branch':'master','base_sha':'9c0b808d1c1e24ea9f3fbba611031cc5cfd5794b','orchestrator':{'requested_model':'GLM 5.3 Flash','runtime_selector':None,'verified':False,'zcode_required':False},'authorizations':{k:False for k in ['inference','implementation','commit','push','pr','merge','close_issues','deploy']},'source_issue_count':len(issues),'source_comment_count':sum(x['comment_count'] for x in issues),'cap_policy':{'actual_model_sessions':2,'route_sessions':2,'primary_nominal_total':12,'count_review_and_probes':True,'reserve_all_known_candidates':True,'unknown_candidate_set_admissible':False,'fallback_only_last':'CODEX'},'routes':routes,'route_preferences':preferences,'issues':issues,'packages':packages,'priority_rule':['critical_path_unlock','data_integrity','review_backlog','ready_age','stable_issue_priority'],'scheduler':'event-driven_work-conserving_maximum_eligible_matching','heavy_resources':{'full_gate':1,'native_builder':1,'android_qa':1,'initial_focused_jest_jobs':2}}
(root/'execution-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
lines=['# Atomic work packages and issue routing','', 'All states are PLANNED. This is a decomposition, not runtime evidence. Every package completes after its gates and independent actual-SHA review; owner/external blockers stay open. No global wave barrier.','', '| Issue | Class / preferred route | Ordered fallback | Package chain | Owner decisions |','|---|---|---|---|---|']
for i in issues:
    lines.append(f'| #{i["number"]} | {i["task_class"]} / {i["ordered_routes"][0]} | '+ ' → '.join(i['ordered_routes'][1:])+' | '+' → '.join(i['package_ids'])+' | '+(', '.join(i['owner_decisions']) or 'execution authorization only')+' |')
lines += ['', 'Routes: AGY-G Gemini3.8Flash/high; AGY-S Sonnet5.5/high (max score not transferable); OMP qualified authorized Agnes/Grok checkpoint; OC-M MiMo2.6Flash (unverified); CLINE DeepSeek4.1Flash; CURSOR auto with complete identity guard; CODEX Luna5.6/max fallback only. Skip every unavailable/unqualified/cap-or-lock-blocked candidate.', '', '## Per-package dependencies and acceptance actions','']
for p in packages:
    lines += ['### '+p['id'], '**Goal:** '+p['goal'], '**Reviewed anchor dependencies:** '+(', '.join(p['dependencies']) or 'none'), '**Preference:** '+' → '.join(p['ordered_routes']), '**Locks:** '+(', '.join(p['locks']) or 'exact isolated files; no global writer lock'), '**Pending prerequisites:** '+(', '.join(p['blocker_requirements']) or 'A1 + qualified route/toolchain'), '']
lines += ['## Focused commands and elementary actions','', 'Freeze the exact existing/new test files from each issue candidate_paths. Under pinned Node22/npm10.9.7 run `npm test -- --runTestsByPath <files> --watchAll=false --maxWorkers=2 --cacheDirectory=<private-cache>`. Fill placeholders in the brief; never execute them literally. New tests import production, not copied helper/DDL. #151 calls both real service methods. Invoke each exact feature Maestro YAML explicitly; qa.sh smoke covers launch only. PLAN.md contains the authoritative CI-split final gate.','', 'Every code slice: (1) read AC/source and freeze one small behavior + exact files, (2) write one failing assertion, (3) run/save RED exit, (4) smallest GREEN, (5) edge/fault probe, (6) coherent commit if authorized, (7) another agent reviews/probes actual SHA, (8) fix every finding and rereview, (9) authorized branch publication and remote SHA readback. Elementary actions should be2–5min-sized where practical; large features split into reviewed30–60min packages.','', 'Each native/live phase can remain blocked without blocking unrelated policy/tests. Discover external health schema/auth immediately in the contract package. #114 first validates the existing routine path after #112, then repeats null-routine recovery after #80 wiring; only its final native acceptance needs #80. #136 conversion policy starts before exporter stabilization; only wiring waits.','', 'Path statuses distinguish existing source from proposed files/generated patterns. Freeze a smaller per-package allowlist before dispatch. An issue-wide path inventory is NOT permission to edit all of it. Same-path production/test writers serialize even if no named global lock is listed.']
(root/'WORK-PACKAGES.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'issues':len(issues),'comments':ledger['source_comment_count'],'packages':len(packages),'root':str(root)}))
