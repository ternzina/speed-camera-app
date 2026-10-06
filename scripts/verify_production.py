#!/usr/bin/env python3
"""Verify actual production read-only exports and database invariants after sync."""
import datetime as dt
import json
from pathlib import Path
import requests
from update_cameras import connect
from bootstrap_cameras import save
ROOT=Path(__file__).resolve().parents[1]
URL='https://ydgzsdlwnurychkbgsmn.supabase.co/functions/v1/camera-export'

def main():
    with connect() as conn:
        coverage={r[0]:r[1] for r in conn.execute('select country_code,total from public.camera_country_coverage')}
        total,active,low,invalid,sections=conn.execute("""select count(*),count(*) filter(where active),
          count(*) filter(where active and confidence not in ('high','medium')),
          count(*) filter(where latitude not between -90 and 90 or longitude not between -180 and 180 or (latitude=0 and longitude=0) or speed_limit not between 5 and 200),
          count(*) filter(where camera_type='average_speed_section' and (end_latitude is null or end_longitude is null)) from public.camera_records""").fetchone()
        assert low==invalid==sections==0
        sources=conn.execute("select count(*),count(*) filter(where source_type='official_government') from public.camera_sources").fetchone()
        osm_only=conn.execute("""select count(*) from public.camera_records r where active and exists
           (select 1 from public.camera_source_links l join public.camera_sources s on s.id=l.source_id where l.camera_record_id=r.id and s.source_type='openstreetmap')
           and not exists(select 1 from public.camera_source_links l join public.camera_sources s on s.id=l.source_id where l.camera_record_id=r.id and s.source_type<>'openstreetmap')""").fetchone()[0]
        duplicates=conn.execute("select count(*) from (select canonical_id from public.camera_records group by canonical_id having count(*)>1) q").fetchone()[0]
        assert duplicates==0
    cache=ROOT/'master-db/cache/bootstrap/exports';cache.mkdir(parents=True,exist_ok=True)
    checks=[]
    r=requests.get(URL,params={'country':'coverage'},timeout=90);r.raise_for_status();payload=r.json()
    assert {x['country_code']:x['total'] for x in payload['countries']}==coverage
    save(cache/'coverage.json',payload)
    for code,expected in sorted(coverage.items()):
        response=requests.get(URL,params={'country':code},timeout=90);response.raise_for_status();feed=response.json();save(cache/(code+'.json'),feed)
        if code=='UA':actual=feed['count'];assert actual==426
        elif code=='PL':
            c=feed['counts'];assert c['speed_cameras']==504 and c['red_light_devices_source']==169 and c['average_speed_sections']==224 and c['average_speed_physical_sections']==137
            actual=c['speed_cameras']+c['red_light_devices_source']+c['average_speed_sections']
        else:
            actual=sum(feed['counts'].values());ids=[]
            for group in ['speed_cameras','red_light_cameras','checkpoints','average_speed_sections']:
                for p in feed[group]:
                    ids.append(p['id']);assert p['confidence'] in ('high','medium') and p['provenance']
                    for s in p['provenance']:assert s['license'] and s['source_url'] and s['source_id']
                    if group=='average_speed_sections':assert p['start']['latitude'] is not None and p['end']['latitude'] is not None
            assert len(set(ids))==len(ids)
        assert actual==expected,(code,expected,actual)
        checks.append({'country_code':code,'database_active_records':expected,'export_records':actual,'result':'passed'})
        print('Production export',code,actual,'verified',flush=True)
    report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'project_ref':'ydgzsdlwnurychkbgsmn','endpoint':URL,
            'database_total':total,'production_active':active,'low_published':low,'invalid_coordinates_or_speed':invalid,
            'sections_missing_endpoints':sections,'duplicate_canonical_ids':duplicates,'sources':sources[0],'official_sources':sources[1],
            'osm_only_active':osm_only,'europe_active':sum(n for c,n in coverage.items() if c not in ('US','CA')),
            'usa_active':coverage.get('US',0),'canada_active':coverage.get('CA',0),'checks':checks}
    save(ROOT/'master-db/bootstrap/reports/production-verification.json',report)
    print('Verified production:',active,'active;',total,'stored;',len(checks),'country feeds')

if __name__=='__main__':main()
