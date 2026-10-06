
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function haversine(aLat:number,aLon:number,bLat:number,bLon:number){
  const R=6371000;
  const rad=(v:number)=>v*Math.PI/180;
  const dLat=rad(bLat-aLat), dLon=rad(bLon-aLon);
  const x=Math.sin(dLat/2)**2 + Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function physicalRedLightSites(devices:any[]){
  const unused = new Set(devices.map((_:any,i:number)=>i));
  const groups:number[][]=[];
  while(unused.size){
    const first = unused.values().next().value as number;
    unused.delete(first);
    const group=[first];
    let changed=true;
    while(changed){
      changed=false;
      for(const j of Array.from(unused)){
        const dj=devices[j];
        const close=group.some(k=>{
          const dk=devices[k];
          const localityCompatible =
            !dj.locality || !dk.locality ||
            String(dj.locality).trim().toLowerCase()===String(dk.locality).trim().toLowerCase();
          return localityCompatible &&
            haversine(Number(dj.latitude),Number(dj.longitude),Number(dk.latitude),Number(dk.longitude))<=120;
        });
        if(close){ unused.delete(j); group.push(j); changed=true; }
      }
    }
    groups.push(group);
  }
  return groups.map(group=>{
    const xs=group.map(i=>devices[i]);
    const lat=xs.reduce((s,x)=>s+Number(x.latitude),0)/xs.length;
    const lon=xs.reduce((s,x)=>s+Number(x.longitude),0)/xs.length;
    const metas=xs.map(x=>x.metadata||{});
    const legacyIds=[...new Set(metas.map(m=>m.legacy_site_id).filter(Boolean).map(String))].sort();
    const legacySubtypes=[...new Set(metas.map(m=>m.legacy_subtype).filter(Boolean).map(String))].sort();
    const officialIds=[...new Set(metas.map(m=>String(m.canard_id ?? m.id ?? "")).filter(Boolean))].sort();
    const roads=[...new Set(xs.map(x=>x.road).filter(Boolean).map(String))].sort();
    const localities=[...new Set(xs.map(x=>x.locality).filter(Boolean).map(String))].sort();
    return {
      id: legacyIds[0] || officialIds[0] || String(xs[0].canonical_id),
      type:"red_light",
      subtype: legacySubtypes.length===1 ? legacySubtypes[0] : null,
      voivodeship: xs.find(x=>x.region)?.region ?? null,
      location: localities[0] ?? null,
      latitude: lat,
      longitude: lon,
      road: roads.length===1 ? roads[0] : roads.join("/"),
      description:null,
      speed_limit:null,
      canard_device_ids:officialIds,
      device_count:xs.length,
      source:"CANARD / GITD",
      source_verified:"2026-10-05"
    };
  });
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const country=(new URL(req.url).searchParams.get("country")||"").toUpperCase();
  if(req.method!=="GET") return new Response("Method not allowed",{status:405,headers:cors});
  if(!/^[A-Z]{2}$/.test(country) && country!=="COVERAGE"){
    return new Response(JSON.stringify({error:"country must be an ISO country code"}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  }

  const supabase=createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {auth:{persistSession:false}}
  );

  if(country==="COVERAGE"){
    const {data,error}=await supabase.from("camera_country_coverage").select("*").order("country_code");
    if(error)return new Response(JSON.stringify({error:error.message}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
    return new Response(JSON.stringify({countries:data||[],source:"Supabase CamAlert Master DB"}),{headers:{...cors,"Content-Type":"application/json","Cache-Control":"public, max-age=300"}});
  }
  const data:any[]=[];
  for(let offset=0;;offset+=1000){
    const {data:page,error}=await supabase.from("camera_records").select("*").eq("country_code",country).eq("active",true).in("confidence",["high","medium"]).order("id").range(offset,offset+999);
    if(error) return new Response(JSON.stringify({error:error.message}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
    data.push(...(page||[]));
    if(!page||page.length<1000)break;
    if(offset>=99999)return new Response(JSON.stringify({error:"country export limit exceeded"}),{status:413,headers:{...cors,"Content-Type":"application/json"}});
  }

  let payload:any;
  if(country==="UA"){
    const cameras=(data||[]).filter(x=>x.record_type==="speed_camera").map(x=>x.metadata);
    payload={source:"Patrol Police Ukraine",retrieved_at:"2026-10-02",count:cameras.length,cameras};
  } else if(country==="PL") {
    const speed=(data||[]).filter(x=>x.record_type==="speed_camera").map(x=>x.metadata);
    const redDevices=(data||[]).filter(x=>x.record_type==="red_light");
    const redSites=physicalRedLightSites(redDevices);
    const opp=(data||[]).filter(x=>x.record_type==="average_speed_section").map(x=>x.metadata);
    const physicalSections=new Set(opp.map((x:any)=>String(x.base_id ?? x.id).split(":")[0])).size;
    payload={
      country:"PL",
      source:{name:"CamAlert Master DB / CANARD",retrieved_at:"2026-10-05",generated_from:"Supabase CamAlert Master DB",red_light_mode:"physical_sites"},
      generated_at:new Date().toISOString(),
      counts:{
        speed_cameras:speed.length,
        red_light_cameras:redSites.length,
        red_light_devices_source:redDevices.length,
        average_speed_sections:opp.length,
        average_speed_physical_sections:physicalSections,
        checkpoints:0
      },
      speed_cameras:speed,
      red_light_cameras:redSites,
      checkpoints:[],
      average_speed_sections:opp
    };
  } else {
    const mapPoint=(x:any)=>({id:x.canonical_id,type:x.record_type,camera_type:x.camera_type,
      latitude:x.latitude,longitude:x.longitude,speed_limit:x.speed_limit,direction:x.direction_code,
      location:x.locality||x.road||x.metadata?.road_name||x.canonical_id,road:x.road,region:x.region,
      confidence:x.confidence,last_seen_at:x.last_seen_at,provenance:x.metadata?.provenance||[]});
    const speed=data.filter(x=>x.record_type==="speed_camera").map(mapPoint);
    const red=data.filter(x=>x.record_type==="red_light").map(mapPoint);
    const checkpoints=data.filter(x=>x.record_type==="checkpoint").map(mapPoint);
    const sections=data.filter(x=>x.record_type==="average_speed_section").map(x=>({
      ...mapPoint(x),type:"average_speed_section",start:{latitude:x.latitude,longitude:x.longitude},
      end:{latitude:x.end_latitude,longitude:x.end_longitude},name:x.road||x.locality||x.canonical_id}));
    const licenses=[...new Set(data.flatMap(x=>(x.metadata?.provenance||[]).map((p:any)=>p.license)).filter(Boolean))];
    payload={country,source:{name:"CamAlert Master DB",generated_from:"Supabase CamAlert Master DB",licenses,
      attribution:"Contains official open data and © OpenStreetMap contributors. OSM-derived data licensed under ODbL 1.0.",
      license_url:"https://www.openstreetmap.org/copyright"},generated_at:new Date().toISOString(),
      counts:{speed_cameras:speed.length,red_light_cameras:red.length,checkpoints:checkpoints.length,average_speed_sections:sections.length},
      speed_cameras:speed,red_light_cameras:red,checkpoints,average_speed_sections:sections};
  }

  return new Response(JSON.stringify(payload),{
    headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=300"}
  });
});
