import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Compatibility endpoint only. Authorization/rate limits live in the Worker; no DB client or secrets.
const WORKER='https://speed-camera-data.ternzina.workers.dev';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-installation-id, content-type","Access-Control-Allow-Methods":"GET, OPTIONS","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export async function cameraExport(req:Request,fetcher:typeof fetch=fetch):Promise<Response> {
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:cors});
 const country=(new URL(req.url).searchParams.get('country')||'').toUpperCase();
 if(!/^[A-Z]{2}$/.test(country))return Response.json({error:'country_required'},{status:400,headers:cors});
 const authorization=req.headers.get('Authorization'),installation=req.headers.get('X-Installation-ID');
 if(!authorization?.startsWith('Bearer ')||!installation)return Response.json({error:'download_authorization_required'},{status:401,headers:cors});
 try {
  const response=await fetcher(`${WORKER}/v2/download/${country}`,{headers:{Authorization:authorization,'X-Installation-ID':installation},redirect:'error',signal:AbortSignal.timeout(20000)});
  const headers=new Headers(cors);
  for(const name of ['Content-Type','Content-Length','X-Content-SHA256','ETag','Retry-After']){const value=response.headers.get(name);if(value)headers.set(name,value);}
  return new Response(response.body,{status:response.status,headers});
 }catch{return Response.json({error:'unavailable'},{status:503,headers:cors});}
}
Deno.serve(cameraExport);
