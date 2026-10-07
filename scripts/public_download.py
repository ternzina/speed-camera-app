"""Public government downloads with a TLS-verified fallback for local DNS failures."""
from urllib.parse import urlsplit
from pathlib import Path
import subprocess,tempfile,ipaddress
import certifi
import requests
import urllib3

def system_tls_get(url,resolve_ip=None,**kwargs):
    """Use macOS' verified TLS stack for a specific legacy CA-extension error."""
    parsed=urlsplit(url);headers=kwargs.get('headers') or {}
    if (parsed.scheme!='https' or parsed.username or parsed.password or kwargs.get('auth') or kwargs.get('cert') or kwargs.get('cookies')
        or kwargs.get('stream') or any(k.lower() in ('authorization','cookie','proxy-authorization','x-api-key','apikey') or 'token' in k.lower() for k in headers)):
        raise requests.exceptions.SSLError('System TLS fallback is limited to public HTTPS downloads')
    prepared=requests.Request('GET',url,params=kwargs.get('params')).prepare().url
    timeout=kwargs.get('timeout',60)
    connect,read=timeout if isinstance(timeout,tuple) else (min(15,timeout),timeout)
    directory=Path(__file__).resolve().parents[1]/'master-db/cache/public-downloads';directory.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=directory) as target:
        command=['/usr/bin/curl','--silent','--show-error','--location','--proto','=https','--proto-redir','=https',
                 '--connect-timeout',str(connect),'--max-time',str(read),'--output',target.name,
                 '--write-out','%{http_code}\n%{url_effective}\n%{content_type}']
        for key,value in headers.items():command.extend(['--header',key+': '+value])
        if resolve_ip:
            ipaddress.ip_address(resolve_ip)
            command.extend(['--resolve',f'{parsed.hostname}:{parsed.port or 443}:{resolve_ip}'])
        command.extend(['--url',prepared])
        result=subprocess.run(command,capture_output=True,text=True,timeout=read+10)
        if result.returncode:
            # Certificate, hostname, expiry and network failures remain fatal.
            raise requests.exceptions.SSLError('Verified system TLS download failed (curl '+str(result.returncode)+')')
        status,effective,content_type=result.stdout.split('\n',2)
        response=requests.Response();response.status_code=int(status);response.url=effective
        response._content=Path(target.name).read_bytes();response.headers['Content-Type']=content_type
        response._source_transport='system_curl_verified_tls'
        return response

def get(url,**kwargs):
    try:return requests.get(url,**kwargs)
    except requests.exceptions.SSLError as exc:
        if 'Missing Subject Key Identifier' not in str(exc):raise
        return system_tls_get(url,**kwargs)
    except requests.ConnectionError as exc:
        if 'NameResolution' not in str(exc) and 'resolve' not in str(exc):raise
        parsed=urlsplit(url)
        if parsed.scheme!='https' or kwargs.get('headers') or kwargs.get('auth'):raise
        answer=requests.get('https://dns.google/resolve',params={'name':parsed.hostname,'type':'A'},timeout=20).json()
        ips=[x['data'] for x in answer.get('Answer',[]) if x['type']==1]
        if not ips:raise
        target=parsed.path or '/'
        if parsed.query:target+='?'+parsed.query
        if kwargs.get('params'):
            target=requests.Request('GET','https://'+parsed.hostname+target,params=kwargs['params']).prepare().path_url
        pool=urllib3.HTTPSConnectionPool(ips[0],assert_hostname=parsed.hostname,server_hostname=parsed.hostname,
                                        cert_reqs='CERT_REQUIRED',ca_certs=certifi.where())
        timeout=kwargs.get('timeout',60)
        if isinstance(timeout,tuple):timeout=urllib3.Timeout(connect=timeout[0],read=timeout[1])
        try:reply=pool.urlopen('GET',target,headers={'Host':parsed.hostname},timeout=timeout,redirect=False)
        except urllib3.exceptions.MaxRetryError as error:
            if 'Missing Subject Key Identifier' not in str(error):raise
            return system_tls_get(url,resolve_ip=ips[0],**kwargs)
        result=requests.Response();result.status_code=reply.status;result._content=reply.data;result.url=url
        result.headers.update(reply.headers);return result
