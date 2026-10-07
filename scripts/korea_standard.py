"""Primary DATA.GO.KR fixed enforcement standard; no address geocoding."""
import collections, concurrent.futures, datetime, html, json, math, re, time
from pathlib import Path
import requests
from public_download import get

ROOT = Path(__file__).resolve().parents[1]

def permission_label(text):
    fields=re.findall(r'<strong\b[^>]*>\s*이용허락범위\s*</strong>\s*<div class="value">(.*?)</div>',text,re.S)
    if len(fields)!=1:return None
    return ' '.join(html.unescape(re.sub(r'<[^>]*>',' ',fields[0])).split())

def acquire(source, capture, reuse_local=False):
    """Use the portal's documented anonymous, <=50k, 10k-per-page download."""
    directory = ROOT/'master-db/raw/coverage-stage/korea'
    providers = ROOT/'master-db/cache/coverage-stage/research/korea-providers'
    directory.mkdir(parents=True, exist_ok=True)
    providers.mkdir(parents=True, exist_ok=True)
    def request(url, path, params=None, post=False):
        if reuse_local and path.exists() and time.time()-path.stat().st_mtime < 86400:
            response = requests.Response(); response.status_code = 200
            response._content = path.read_bytes(); response.url = requests.Request('GET',url,params=None if post else params).prepare().url
        else:
            for attempt in range(3):
                try:
                    response = requests.post(url,data=params,timeout=(20,120)) if post else get(url,params=params,timeout=(20,150))
                    response.raise_for_status();path.write_bytes(response.content);break
                except requests.RequestException:
                    if attempt == 2:raise
                    time.sleep(2)
        capture(response,source,'html' if path.suffix=='.html' else 'json')
        return response
    header_path = ROOT/'master-db/cache/coverage-stage/research/korea-download-columns.json'
    header = request('https://www.data.go.kr/download/columList.json',header_path,{'pk':'15028200','ext':'CSV'}).json()
    total = header['totalCount'];table = header['tableVO']
    assert total == source['expected_raw_rows'] and 0 < total <= 50000, 'Changed count or public download limit exceeded'
    assert table['svcTableNm']=='tn_pubr_public_unmanned_traffic_camera_svc'
    original=[]
    for page in range(1,(total+9999)//10000+1):
        params=[('publicDataPk','15028200')]+[('colNmList',v) for v in table['colNmList']]+[('totalCount',total),('svcTableNm',table['svcTableNm']),('perPage',10000),('page',page)]
        rows=request(source['download_url'],directory/f'page-{page}.json',params).json()
        assert isinstance(rows,list) and len(rows)==min(10000,total-(page-1)*10000),'Incomplete standard page'
        original.extend(rows)
    assert len(original)==total
    ids=[]
    for page in range(1,(source['expected_providers']+4)//5+1):
        text=request('https://www.data.go.kr/tcs/dss/stdFileList.do',providers/f'list-{page}.html',{'publicDataPk':'15028200','searchKeyword2':'','pageIndex':page},post=True).text
        ids.extend(re.findall(r'data-public-pk="([^"]+)"',text))
    assert len(ids)==len(set(ids))==source['expected_providers'],'Incomplete provider license catalog'
    def license_check(identity):
        text=request('https://www.data.go.kr/tcs/dss/selectDpkDetailInfo.do',providers/(identity.replace(':','_')+'.html'),{'publicDataDetailPk':identity},post=True).text
        match=re.search(r'제공기관</strong>\s*<div class="value">([^<]+)</div>',text)
        assert match,'Provider name unavailable'
        permission=permission_label(text)
        return {'identity':identity,'name':html.unescape(match[1]).strip(),'permission_label':permission,'unrestricted':permission=='이용허락범위 제한 없음'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:licenses=list(pool.map(license_check,ids))
    allowed={row['name'] for row in licenses if row['unrestricted']}
    result,counts=normalize_rows(original,allowed)
    counts.update(server_count=total,provider_licenses_checked=len(licenses),unrestricted_provider_licenses=sum(row['unrestricted'] for row in licenses),provider_license_results=licenses)
    return result,counts

KNOWN_CODES = {'1', '2', '3', '4', '99'}

def normalize_rows(rows, allowed_providers, today=None):
    """Keep speed/signal devices, preserve uncertainty and original public fields."""
    today = today or datetime.datetime.now(datetime.timezone.utc).date()
    counts = collections.Counter(raw_records=len(rows))
    result = []
    identities = collections.Counter()
    for row in rows:
        parts = [str(row.get(k) or '').strip() for k in
                 ('INSTT_CODE', 'CTPRVN_NM', 'SIGNGU_NM', 'MNLSS_REGLT_CAMERA_MANAGE_NO')]
        identities[tuple(parts)] += 1
    for raw in rows:
        if raw.get('INSTT_NM') not in allowed_providers:
            counts['unverified_provider_license'] += 1
            continue
        values = str(raw.get('REGLT_SE') or '').strip().split('+')
        codes = {v.strip().lstrip('0') for v in values}
        if any(v.strip() not in {'1','2','3','4','99','01','02','03','04'} for v in values) or not codes <= KNOWN_CODES or not codes & {'1', '2'}:
            counts['excluded_non_speed_signal_or_unknown_type'] += 1
            continue
        try:
            lat, lon = float(raw['LATITUDE']), float(raw['LONGITUDE'])
            assert math.isfinite(lat) and math.isfinite(lon) and 32 <= lat <= 40 and 124 <= lon <= 132
        except (KeyError, TypeError, ValueError, AssertionError):
            counts['invalid_or_missing_coordinates'] += 1
            continue
        parts = [str(raw.get(k) or '').strip() for k in
                 ('INSTT_CODE', 'CTPRVN_NM', 'SIGNGU_NM', 'MNLSS_REGLT_CAMERA_MANAGE_NO')]
        if not parts[0] or not parts[1] or not parts[3] or identities[tuple(parts)] != 1:
            counts['missing_or_ambiguous_source_identity'] += 1
            continue
        reason = None
        try:
            reference = datetime.date.fromisoformat(str(raw.get('REFERENCE_DATE', '')))
            if not 0 <= (today-reference).days <= 366:
                reason = 'Agency reference date is stale or future-dated; current operation unverified'
        except ValueError:
            reason = 'Agency reference date missing or malformed; current operation unverified'
        section = str(raw.get('REGLT_SCTN_LC_SE') or '').strip()
        length = str(raw.get('OVRSPD_REGLT_SCTN_LT') or '').strip()
        typ = 'speed_and_red_light' if {'1', '2'} <= codes else 'fixed_speed' if '1' in codes else 'red_light'
        if section or length:
            typ = 'other_enforcement'
            reason = 'Section endpoint has no verified paired device identity/geometry; no section invented'
        p = dict(raw, _coverage_id='|'.join(parts), _coverage_type=typ,
                 _coverage_review_reason=reason)
        # 01/02/03 are route directions, never degree bearings.
        p['_coverage_direction'] = {'1': 'route_upbound', '2': 'route_downbound', '3': 'route_both_directions'}.get(
            str(raw.get('ROAD_ROUTE_DRC') or '').strip().lstrip('0'))
        result.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}, 'properties': p})
        counts['low_candidates' if reason else 'current_typed_devices'] += 1
    counts['parsed_records'] = len(result)
    return result, dict(counts)
