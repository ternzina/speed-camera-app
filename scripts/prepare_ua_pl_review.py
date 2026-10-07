#!/usr/bin/env python3
"""Prepare a scoped evidence-backed promotion plan; never writes PostgreSQL."""
import json,collections,datetime,copy,hashlib
from pathlib import Path
from bootstrap_cameras import dist
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'master-db/raw/ua-pl';CACHE=ROOT/'master-db/cache/ua-pl';REPORT=ROOT/'master-db/ua-pl'
def load(p):return json.loads(p.read_text())
def official_source(code,url,license_url,payload):
 return {'source_code':code,'source_id':str(payload['id']),'source_type':'official_government','source_name':'CANARD / GITD current device details','source_url':url,'license':'CC-BY-3.0-PL','license_url':license_url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'raw_payload':payload,'raw_payload_sha256':hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
def main():
 REPORT.mkdir(exist_ok=True);candidates=load(CACHE/'candidates.json');op=load(ROOT/'master-db/backups/ua-pl/operational-before.json');master=load(ROOT/'master-db/backups/ua-pl/master-before.json');byid={r['canonical_id']:r for r in master};primary={}
 for p in (RAW/'osm-primary').glob('*.json'):
  for e in load(p)['elements']:primary[f"{e['type']}/{e['id']}"]=e
 details={str(r['id']):r for p in (RAW/'device-details').glob('*.json') for r in [load(p)]};promotions=[];decisions=[];now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 known={str(r['metadata'].get('canard_id')) for r in op if r['country_code']=='PL'}
 for oid,d in details.items():
  if d['urzadzenie']['rodzajPomiaru']!='PP' or oid in known:continue
  u=d['urzadzenie'];assert u['stanTechniczny']=='Sprawne' and u['dataUplywuWazLegalizacji']>=now[:10] and u['mobilne'] is False
  x={'latitude':d['lat'],'longitude':d['lon']};limits={int(a['limitOsobowe']) for a in d['limity']};assert len(limits)==1;speed=limits.pop()
  near=[r for r in candidates if r['country_code']=='PL' and r['camera_type']=='fixed_speed' and dist(r,x)<=30 and r.get('speed_limit')==speed]
  if near:
   r=copy.deepcopy(min(near,key=lambda r:dist(r,x)));assert primary[r['camera_sources'][0]['source_id']]['tags'].get('highway')=='speed_camera'
  else:
   r={k:None for k in ('end_latitude','end_longitude','direction','road_name','city','region','road_ref','direction_raw')};r.update(canonical_id='PL_CANARD_CURRENT:'+oid,country_code='PL',camera_type='fixed_speed',camera_sources=[],first_seen_at=now)
  direction=d['limity'][0]['typ'].get('kierunekPikietazu');direction={'ROSNACY':'increasing_chainage','MALEJACY':'decreasing_chainage'}.get(direction)
  r.update(x,confidence='HIGH',status='active',speed_limit=speed,road_ref=u['lokalizacjaNrDrogi'],road_name=u.get('lokalizacjaAdresUlica'),city=u.get('lokalizacjaAdresMiejscowosc'),region=u.get('lokalizacjaAdresWojewodztwo'),direction_raw=direction,last_seen_at=now,updated_at=now,publication_review='ua_pl_official_v1')
  r.pop('review_reason',None);r['camera_sources'].append(official_source('PL_CANARD_CURRENT','https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen','https://www.gov.pl/web/gitd/ponowne-wykorzystanie-informacji-sektora-publicznego',d));promotions.append(r)
 # NPU's sequence IDs differ from the old Patrol sequence: match geography,
 # not naked inventoryNumber. The unique uncovered MVS point has current OSM.
 for x in load(CACHE/'mvs-unrepresented.json'):
  official=x['row'];matched=[r for r in candidates if r['country_code']=='UA' and any(s['source_code']=='UA_NPU_CURRENT' for s in r['camera_sources']) and dist(r,official)<1]
  if not matched:continue
  r=copy.deepcopy(matched[0]);osm=[c for c in candidates if c['country_code']=='UA' and c['camera_type']=='fixed_speed' and dist(c,r)<25 and c['canonical_id'].startswith('OSM_UA:')]
  if not osm:continue
  c=min(osm,key=lambda c:dist(c,r));src=c['camera_sources'][0];e=primary[src['source_id']]
  assert e['tags'].get('highway')=='speed_camera' and dist(r,{'latitude':e['lat'],'longitude':e['lon']})<25
  src=copy.deepcopy(src);src.update(retrieved_at=now,raw_payload={'primary_api':e},raw_payload_sha256=hashlib.sha256(json.dumps(e,sort_keys=True).encode()).hexdigest());r['camera_sources'].append(src)
  r.update(confidence='HIGH',status='active',speed_limit=c.get('speed_limit'),road_ref='М-30',road_name=official['address'],updated_at=now,last_seen_at=now,publication_review='ua_pl_official_v1');r.pop('review_reason',None);promotions.append(r)
 promoted={r['canonical_id'] for r in promotions};dup={};groups=collections.defaultdict(collections.Counter)
 for r in candidates:
  country=r['country_code'];reason=[];nearest=min([(dist(r,p),p) for p in op if p['country_code']==country and p['camera_type']==r['camera_type']],key=lambda v:v[0],default=(1e9,None));d,p=nearest
  # Exact CANARD location code + current device geometry is a stronger identity
  # link than proximity or a missing bearing alone. Opposing section directions
  # and red-light approaches are deliberately left for review.
  tags=r['camera_sources'][0].get('raw_payload',{}).get('tags',{});ref=tags.get('ref');matched=None
  if country=='PL' and r['camera_type']=='fixed_speed' and ref:
   for pub in op:
    detail=details.get(str(pub['metadata'].get('canard_id')))
    if pub['country_code']=='PL' and pub['camera_type']=='fixed_speed' and detail and detail['urzadzenie'].get('lokalizacjaKod')==ref and dist(r,pub)<=100 and (r.get('speed_limit') is None or r['speed_limit']==pub['speed_limit']):matched=pub;break
  for new in promotions:
   if r['canonical_id']!=new['canonical_id'] and r['country_code']==new['country_code'] and r['camera_type']==new['camera_type'] and dist(r,new)<=25 and r.get('speed_limit') in (None,new.get('speed_limit')):matched=new
  if matched:dup[r['canonical_id']]=matched['canonical_id'];reason.append('verified_duplicate')
  elif d<=100:reason.append('duplicate_suspicion')
  if r['confidence']=='LOW':reason.append('LOW_confidence')
  if r.get('direction') is None:reason.append('missing_direction')
  if not any(s['source_type']=='official_government' for s in r['camera_sources']):reason.append('missing_source_validation')
  if 'conflict' in r.get('review_reason','').lower() or 'disagreement' in r.get('review_reason','').lower():reason.append('conflicting_metadata')
  if r.get('speed_limit') is None or not (r.get('road_ref') or r.get('road_name')):reason.append('incomplete_metadata')
  for why in reason:groups[country][why]+=1
  decisions.append({'canonical_id':r['canonical_id'],'country':country,'reasons':reason,'primary_osm_present':all(s['source_id'] in primary for s in r['camera_sources'] if s['source_type']=='openstreetmap'),'nearest_published_metres':round(d,3) if d<1e9 else None,'outcome':'publish' if r['canonical_id'] in promoted else 'verified_duplicate' if r['canonical_id'] in dup else 'remain_private','duplicate_of':dup.get(r['canonical_id'])})
 # Never publish another direction as a "new pole". No existing published row
 # is changed by this plan. Pair distance for all new fixed devices must be >30m.
 for r in promotions:
  assert all(dist(r,p)>30 for p in op if r['country_code']==p['country_code'] and r['camera_type']==p['camera_type'])
 (CACHE/'promotion-plan.json').write_text(json.dumps({'promotions':promotions,'duplicates':dup,'decisions':decisions},ensure_ascii=False))
 report={'prepared_at':now,'scope':['UA','PL'],'candidates_before':dict(collections.Counter(r['country_code'] for r in candidates)),'reason_counts_overlapping':{k:dict(v) for k,v in groups.items()},'primary_osm_refresh':load(CACHE/'primary-refresh-summary.json'),'promotions':dict(collections.Counter(r['country_code'] for r in promotions)),'verified_duplicates':dict(collections.Counter(byid[k]['country_code'] for k in dup)),'promoted_ids':[r['canonical_id'] for r in promotions],'official_map_counts':{'UA_MVS':400,'PL_fixed':498,'PL_red_light_devices':169,'PL_average_physical_sections':137},'opp_direction_audit':load(CACHE/'opp-direction-audit.json'),'notes':['Reason groups overlap; missing bearing alone does not establish a new device or require invented direction.','Ukraine current NPU inventory numbers are not the legacy Patrol sequence; all dedupe uses geography/equipment.','CANARD coordinates and technical/current legalisation details verified; two-way section variants remain intact.']}
 (REPORT/'review.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(report)
if __name__=='__main__':main()
