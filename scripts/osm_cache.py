"""Phase snapshots: refresh replaces observations instead of accumulating stale objects."""
import datetime as dt

def identity(e):return e['type']+'/'+str(e['id'])

def snapshots(data):
    if '_snapshots' in data:return data['_snapshots']
    result={'speed':[],'enforcement':[],'seed':[]}
    stamp=data.get('_bootstrap',{}).get('retrieved_at')
    for e in data.get('elements',[]):
        e={**e,'_observed_at':e.get('_observed_at',stamp)}
        phase='speed' if e['type']=='node' and e.get('tags',{}).get('highway')=='speed_camera' else 'enforcement'
        result[phase].append(e)
    return result

def replace_phase(prior, phase, elements, timestamp=None, attempted_ids=None):
    timestamp=timestamp or dt.datetime.now(dt.timezone.utc).isoformat()
    buckets=snapshots(prior)
    if phase=='speed':buckets['seed']=[] # complete current envelope supersedes seed coverage
    if phase=='seed' and attempted_ids is not None:
        attempted={str(x) for x in attempted_ids}
        # Current authoritative API includes retagged nodes; absent/deleted nodes
        # must not survive as older speed observations from the same OSM source.
        for key in ['speed','enforcement']:
            buckets[key]=[e for e in buckets[key] if not(e['type']=='node' and str(e['id']) in attempted)]
    buckets[phase]=[{**e,'_observed_at':timestamp} for e in elements]
    combined={}
    for items in buckets.values():
        for e in items:
            key=identity(e)
            if key not in combined or (e.get('_observed_at') or '')>=(combined[key].get('_observed_at') or ''):combined[key]=e
    return {**prior,'_snapshots':buckets,'elements':list(combined.values())}
