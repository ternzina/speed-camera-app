"""Public government downloads with a TLS-verified fallback for local DNS failures."""
from urllib.parse import urlsplit
import certifi
import requests
import urllib3

def get(url,**kwargs):
    try:return requests.get(url,**kwargs)
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
        reply=pool.urlopen('GET',target,headers={'Host':parsed.hostname},timeout=kwargs.get('timeout',60),redirect=False)
        result=requests.Response();result.status_code=reply.status;result._content=reply.data;result.url=url
        result.headers.update(reply.headers);return result
