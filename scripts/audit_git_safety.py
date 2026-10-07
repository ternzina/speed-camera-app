#!/usr/bin/env python3
"""Scan the publication branch (including reachable history) without exposing secrets."""
import datetime as dt
import json
import re
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATTERNS={
 'literal_credential':rb'''(?i)\b(?:password|api_key|service_role_key|client_secret|access_token|refresh_token)["']?\s*[:=]\s*["'][^"'\r\n]{12,}["']''',
 'sql_password':rb'''(?i)\bPASSWORD\s+['"][^'"\r\n]{12,}['"]''',
 'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
 'github_token':rb'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b',
 'aws_access_key':rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'supabase_secret':rb'\bsb_secret_[A-Za-z0-9_-]{15,}\b',
 'openai_key':rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}\b',
 'google_api_key':rb'\bAIza[A-Za-z0-9_-]{35}\b',
 'slack_token':rb'\bxox[baprs]-[A-Za-z0-9-]{15,}\b',
 'jwt_key_or_token':rb'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b',
 'credential_url':rb'https?://[^\s/:]+:[^\s/@]+@',
}
EXCLUDED=re.compile(r'(^|/)(\.env[^/]*|credentials(?:\.json)?|node_modules|\.expo|\.bootstrap-venv)(/|$)|\.(?:jks|keystore|p8|p12|pfx|pem|key|mobileprovision|ipa|apk|aab)$|^master-db/(?:raw|cache|backups)/')
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def main():
    head=git('rev-parse','HEAD').decode().strip()
    files=git('ls-tree','-r','--name-only',head).decode().splitlines()
    forbidden=[p for p in files if EXCLUDED.search(p)]
    objects=git('rev-list','--objects','main').decode().splitlines();checked=set();findings=[]
    for line in objects:
        parts=line.split(' ',1)
        if len(parts)<2:continue
        sha,name=parts
        if sha in checked:continue
        if git('cat-file','-t',sha).strip()!=b'blob':continue
        checked.add(sha);data=git('cat-file','blob',sha)
        for kind,pattern in PATTERNS.items():
            if re.search(pattern,data):findings.append({'path':name,'finding':kind,'blob':sha})
    report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'branch':'main','commit':head,
            'tracked_files':len(files),'history_blobs_checked':len(checked),'forbidden_files_in_head':forbidden,
            'secret_findings':findings,'excluded_actual_sensitive_files':sorted(str(p.relative_to(ROOT)) for pattern in ('.env*','*.jks','*.keystore','credentials.json') for p in ROOT.glob(pattern) if p.is_file()),'excluded_local_paths':['.env.bootstrap','*.jks','node_modules/','.expo/','.bootstrap-venv/',
             'master-db/raw/','master-db/cache/','master-db/backups/','*.backup-*','*.before-*','build artifacts'],
            'note':'Previously published small non-secret server backups were removed from the current tree; unpublished bootstrap backup commit kept only on a local branch.'}
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='master-db/bootstrap/reports/git-safety.json');args=parser.parse_args()
    target=ROOT/args.output;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'tracked_files':len(files),'history_blobs_checked':len(checked),'forbidden_files':forbidden,'secret_findings':findings}))
    if forbidden or findings:raise SystemExit('STOP: publication safety findings require review')
if __name__=='__main__':main()
