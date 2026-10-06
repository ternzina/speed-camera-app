#!/usr/bin/env python3
"""Resumable, country-sized Overpass downloads; never query all countries at once."""
import argparse
import concurrent.futures
import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'master-db/cache/bootstrap/osm'
COUNTRIES = dict(zip(
    'UA PL FR ES DE GB IE PT IT AT CH BE NL LU DK SE NO FI IS CZ SK HU RO BG HR SI RS BA ME MK AL GR LT LV EE MD CY MT XK TR AD LI MC SM VA US CA'.split(),
    ['Ukraine','Poland','France','Spain','Germany','United Kingdom','Ireland','Portugal','Italy','Austria','Switzerland','Belgium','Netherlands','Luxembourg','Denmark','Sweden','Norway','Finland','Iceland','Czech Republic','Slovakia','Hungary','Romania','Bulgaria','Croatia','Slovenia','Serbia','Bosnia and Herzegovina','Montenegro','North Macedonia','Albania','Greece','Lithuania','Latvia','Estonia','Moldova','Cyprus','Malta','Kosovo','Turkey','Andorra','Liechtenstein','Monaco','San Marino','Vatican City','USA','Canada']))
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

def boxes(code):
    from shapely.geometry import shape
    special = {'FR': [(41,-5.5,51.5,10)], 'ES': [(35,-10,44.5,5),(27,-19,30,-13)],
               'NO': [(57,4,72,32),(74,10,81,35)],
               'PT': [(36,-10,43,-6),(30,-32,41,-15)],
               'US': [(24,-125,50,-66),(50,-180,72,-129),(18,-161,23,-154)],
               'CA': [(41,-141,65,-100),(41,-100,65,-52),(65,-141,84,-52)]}
    if code in special: return special[code]
    data=json.loads((CACHE.parent/'countries.geojson').read_text())
    for f in data['features']:
        props=f['properties']
        named={'France':'FR','Norway':'NO','Kosovo':'XK'}.get(props['name'])
        if props.get('ISO3166-1-Alpha-2')==code or named==code:
            west,south,east,north=shape(f['geometry']).bounds
            return [(south-.01,west-.01,north+.01,east+.01)]
    raise ValueError('No country boundary: '+code)

def fetch(code, refresh=False, phase='speed'):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{code}.json'
    if path.exists() and not refresh:
        x = json.loads(path.read_text())
        if 'remark' not in x and 'elements' in x and phase in x.get('_bootstrap',{}).get('phases',['speed','enforcement']):
            return code, len(x['elements']), 'cached'
    # Country area queries can be expensive. Country/region envelopes are clipped to
    # independently downloaded country polygons by the normalizer, never assigned blindly.
    clauses=[]
    for bbox in boxes(code):
        b=','.join(str(round(v,5)) for v in bbox)
        if phase=='speed':clauses.append(f'node[highway=speed_camera]({b});')
        else:clauses.append(f'rel[type=enforcement]({b});')
    if phase=='speed':query='[out:json][timeout:45];('+''.join(clauses)+');out meta center;'
    else:
        extras=[]
        for bbox in boxes(code):
            b=','.join(str(round(v,5)) for v in bbox)
            extras.extend([f'node[enforcement~"^(maxspeed|speed|average_speed|redlight|red_light|traffic_signals|traffic_lights|section_control)$"]({b});',f'way[highway=speed_camera]({b});'])
        query='[out:json][timeout:45];('+''.join(clauses)+')->.enforcement;.enforcement out meta center;('+''.join(extras)+'node(r.enforcement:"device");node(r.enforcement:"from");node(r.enforcement:"to"););out meta center;'
    errors = []
    for attempt in range(6):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(endpoint+'?'+urllib.parse.urlencode({'data': query}),
                                         headers={'User-Agent': 'SpeedCameraBootstrap/1.0 (+https://github.com/ternzina/speed-camera-app; open data import)'})
            with urllib.request.urlopen(req, timeout=65) as response:
                raw = response.read()
            data = json.loads(raw)
            if data.get('remark') or 'elements' not in data:
                raise ValueError(data.get('remark', 'invalid response'))
            prior=json.loads(path.read_text()) if path.exists() else {}
            phases=set(prior.get('_bootstrap',{}).get('phases',[]));phases.add(phase)
            # Refresh of one phase must not erase the other phase's observations.
            if prior:data['elements']=prior.get('elements',[])+data['elements']
            data['_bootstrap'] = {'country_code': code, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'phases':sorted(phases),
                                  'endpoint': endpoint, 'query': query, 'license': 'ODbL-1.0',
                                  'source_url': 'https://www.openstreetmap.org/copyright'}
            tmp = path.with_suffix('.tmp')
            tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
            tmp.replace(path)
            print(f'{code}: {len(data["elements"])} OSM elements downloaded', flush=True)
            return code, len(data['elements']), 'downloaded'
        except Exception as exc:
            errors.append(f'{endpoint}: {type(exc).__name__}: {exc}')
            print(f'{code} attempt {attempt+1}: {str(exc)[:160]}', flush=True)
            time.sleep(30 if isinstance(exc,urllib.error.HTTPError) and exc.code in (429,406) else min(30, 3 * 2 ** attempt))
    (CACHE / f'{code}.error.json').write_text(json.dumps({'country_code': code, 'errors': errors}, indent=2))
    return code, 0, 'failed'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--countries', nargs='+', default=list(COUNTRIES))
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--phase',choices=['speed','enforcement'],default='speed')
    parser.add_argument('--workers', type=int, choices=[1, 2], default=1)
    args = parser.parse_args()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(fetch, code, args.refresh, args.phase) for code in args.countries]
        result = [f.result() for f in concurrent.futures.as_completed(futures)]
    (ROOT / ('master-db/bootstrap/reports/osm-downloads-'+args.phase+'.json')).write_text(json.dumps(sorted(result), indent=2))

if __name__ == '__main__':
    main()
