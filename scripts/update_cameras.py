#!/usr/bin/env python3
"""One-command download -> normalize -> validate -> batch sync -> read-back.

Run with the isolated .bootstrap-venv interpreter. Secrets are read only from
the ignored, mode-0600 .env.bootstrap created for the least-privilege DB login.
No production cron, deletions, or replacements of local app fallback JSONs.
"""
import argparse
import collections
import datetime as dt
import gzip
import hashlib
import json
import time
from public_download import get as public_get
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
from fetch_osm import COUNTRIES, fetch
from fetch_official import main as fetch_official
from fetch_osm_seeded import main as fetch_seeded
from bootstrap_cameras import main as normalize, save

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'master-db/bootstrap'
DATA=ROOT/'master-db/cache/bootstrap/normalized'

def connect():
    creds=json.loads((ROOT/'.env.bootstrap').read_text())
    return psycopg.connect(host=creds['host'],port=5432,user=creds['user']+'.'+creds['project_ref'],
                           password=creds['password'],dbname='postgres',sslmode='require',connect_timeout=15,
                           prepare_threshold=None)

def ensure_inputs():
    boundary=ROOT/'master-db/cache/bootstrap/countries.geojson'
    if not boundary.exists():
        boundary.parent.mkdir(parents=True,exist_ok=True)
        response=public_get('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',timeout=90)
        response.raise_for_status();boundary.write_bytes(response.content)
    ontario=ROOT/'master-db/cache/bootstrap/ontario.geojson'
    if not ontario.exists():
        response=public_get('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',timeout=90)
        response.raise_for_status();features=[f for f in response.json()['features'] if f['properties'].get('iso_3166_2')=='CA-ON']
        assert len(features)==1,'Ontario policy boundary unavailable'
        save(ontario,{'type':'FeatureCollection','features':features})
    baseline=ROOT/'master-db/backups/pre-bootstrap-20261007/baseline-records.json'
    if not baseline.exists():
        with connect() as conn:rows=[x[0] for x in conn.execute('select camera_bootstrap_private.baseline_records()')]
        assert len(rows)==1323,'unexpected immutable bootstrap baseline'
        save(baseline,rows)

def load_records():
    records=[]
    for path in sorted(DATA.glob('*.json.gz')):records.extend(json.loads(gzip.decompress(path.read_bytes())))
    return records

def recover_unsnapshotted():
    """Retain old aliases/database observations after interrupted snapshot transitions."""
    known=[r['canonical_id'] for r in load_records()]
    if not known:return
    with connect() as conn:
        rows=list(conn.execute("select canonical_id,metadata from public.camera_records where metadata ? 'provenance' and not (canonical_id=any(%s))",(known,)))
        grouped=collections.defaultdict(list)
        for cid,meta in rows:
            if not meta.get('canonical_id') or meta.get('protected_existing'):continue
            sources=[]
            for raw, in conn.execute('select l.raw_payload from public.camera_source_links l join public.camera_records r on r.id=l.camera_record_id where r.canonical_id=%s',(cid,)):
                source=raw.get('_source')
                if source:sources.append({**source,'raw_payload':{k:v for k,v in raw.items() if k!='_source'}})
            grouped[meta['country_code']].append({**meta,'camera_sources':sources,'historical_provenance':meta.get('provenance',[])})
        for code,extra in grouped.items():
            path=DATA/(code+'.json.gz');prior=json.loads(gzip.decompress(path.read_bytes())) if path.exists() else []
            path.write_bytes(gzip.compress(json.dumps(prior+extra,ensure_ascii=False).encode(),mtime=0))

def validate(records):
    ids=set(); source_ids=set(); types=collections.Counter(); low_active=[]
    original={r['canonical_id']:r for r in json.loads((ROOT/'master-db/backups/pre-bootstrap-20261007/baseline-records.json').read_text())}
    for r in records:
        assert r['canonical_id'] not in ids, 'duplicate canonical id'
        ids.add(r['canonical_id']);types[r['camera_type']]+=1
        assert -90<=r['latitude']<=90 and -180<=r['longitude']<=180 and (r['latitude'],r['longitude'])!=(0,0)
        assert r['speed_limit'] is None or 5<=r['speed_limit']<=200
        assert r.get('direction') is None or 0<=r['direction']<360
        if r['camera_type']=='average_speed_section':
            assert r.get('end_latitude') is not None and r.get('end_longitude') is not None
            assert -90<=r['end_latitude']<=90 and -180<=r['end_longitude']<=180
        for source in r['camera_sources']:
            key=source['source_code'],source['source_id']
            assert key not in source_ids, 'duplicate external source identity: '+str(key)
            source_ids.add(key)
            assert source['source_url'].startswith('https://') and source['license'] and source['retrieved_at']
        if r.get('protected_existing'):
            b=original[r['canonical_id']]
            for f in ['latitude','longitude','end_latitude','end_longitude','speed_limit','direction_code','direction_name','road','record_type']:
                assert r.get(f)==b.get(f), 'production baseline changed: '+f
        elif r['confidence']=='LOW' and r['status']=='active':low_active.append(r['canonical_id'])
    assert not low_active
    assert set(original)<=ids,'lost production baseline records'
    report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'record_count':len(records),
            'countries':len({r['country_code'] for r in records}),'camera_types':dict(types),
            'baseline_records_preserved':len(original),'source_records':len(source_ids),
            'invalid_coordinates':0,'duplicate_canonical_ids':0,'duplicate_source_ids':0,'low_confidence_active':0,
            'notes':['Country membership checked against Natural Earth 1:10m polygons during normalization.',
                     'OSM envelopes clipped to country polygons; uncertain official coordinates quarantined.',
                     'Non-numeric direction and conditional/multi-valued maxspeed retained in raw provenance, not guessed.']}
    save(BASE/'reports/validation.json',report)
    return report

def fingerprint(r):
    fields=['country_code','camera_type','latitude','longitude','end_latitude','end_longitude','speed_limit','direction','road_name','road_ref','city','region','confidence','status']
    return {k:round(r[k],9) if k in ('latitude','longitude','end_latitude','end_longitude') and r.get(k) is not None else r.get(k) for k in fields}

def sync(records):
    pending=[r for r in records if r['camera_sources'] or not r.get('protected_existing')]
    with connect() as conn:
        before={cid:metadata for cid,metadata in conn.execute('select canonical_id,metadata from public.camera_records')}
        diff={'new':[],'changed':[],'missing_sources':json.loads((BASE/'reports/missing-observations.json').read_text()) if (BASE/'reports/missing-observations.json').exists() else [],'missing_from_snapshot':[],'unchanged_count':0,'never_delete_on_single_source_absence':True}
        for r in records:
            cid=r['canonical_id']
            if cid not in before:diff['new'].append(cid)
            elif r.get('protected_existing'):diff['unchanged_count']+=1
            elif fingerprint(r)!=fingerprint(before[cid]):diff['changed'].append(cid)
            else:diff['unchanged_count']+=1
        diff['missing_from_snapshot']=sorted(set(before)-{r['canonical_id'] for r in records})
        # Batch transactions permit safe resume after process/network interruption.
        totals=collections.Counter()
        for offset in range(0,len(pending),250):
            batch=pending[offset:offset+250]
            for attempt in range(3):
                try:
                    result=conn.execute('select camera_bootstrap_private.ingest_batch(%s)',(Jsonb(batch),)).fetchone()[0]
                    conn.commit();totals.update(result);break
                except (psycopg.OperationalError,psycopg.errors.DeadlockDetected,psycopg.errors.SerializationFailure):
                    conn.rollback()
                    if attempt==2:raise
                    time.sleep(2**attempt)
            print('Supabase batch',min(offset+len(batch),len(pending)),'/',len(pending),flush=True)
        counts=[dict(country_code=c,camera_type=t,count=n,active=a) for c,t,n,a in conn.execute(
            'select country_code,camera_type,count(*),active from public.camera_records group by 1,2,4 order by 1,2,4')]
        current=conn.execute('select count(*) from public.camera_records').fetchone()[0]
        low=conn.execute("select count(*) from public.camera_records where active and confidence in ('low','unverified','disputed')").fetchone()[0]
        assert low==0,'LOW records published'
        # Every imported identity and coordinate is compared against the actual database.
        actual={cid:(lat,lon,kind) for cid,lat,lon,kind in conn.execute('select canonical_id,latitude,longitude,camera_type from public.camera_records')}
        for r in records:
            observed=actual.get(r['canonical_id'])
            assert observed and abs(observed[0]-r['latitude'])<1e-9 and abs(observed[1]-r['longitude'])<1e-9 and observed[2]==r['camera_type'],r['canonical_id']
        source_links=conn.execute('select count(*) from public.camera_source_links').fetchone()[0]
        save(BASE/'reports/supabase-sync.json',{'finished_at':dt.datetime.now(dt.timezone.utc).isoformat(),
             'records_in_database':current,'source_links':source_links,'rows_checked':len(records),'batch_totals':dict(totals),'counts':counts,'low_active':low})
        save(BASE/'reports/update-diff.json',diff)
        print('Supabase read-back verified',current,'records;',source_links,'source links',flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--sync-only',action='store_true');parser.add_argument('--normalize-only',action='store_true')
    parser.add_argument('--resume',action='store_true',help='Reuse completed source downloads instead of refreshing')
    parser.add_argument('--countries',nargs='+',default=list(COUNTRIES));args=parser.parse_args()
    ensure_inputs()
    if args.sync_only:records=load_records()
    else:
        if not args.normalize_only:
            fetch_official(refresh=not args.resume)
            fetch_seeded(refresh=not args.resume,countries=args.countries)
            for phase in ['speed','enforcement']:
                for c in args.countries:fetch(c,refresh=not args.resume,phase=phase)
        recover_unsnapshotted()
        records=normalize()
    report=validate(records);print('Validation passed:',report['record_count'],'records',flush=True)
    if not args.normalize_only:sync(records)

if __name__=='__main__':main()
