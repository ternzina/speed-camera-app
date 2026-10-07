import { leafletJS, leafletCSS } from "./map-vendor/leaflet-assets";
export function androidMapHTML(region) {
  const start = JSON.stringify(region).replace(/</g, "\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>${leafletCSS}
  html,body,#map{height:100%;width:100%;margin:0;background:#e3eaf1}
  .cam-pin{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:2px solid #aac4e5;border-radius:50%;background:#fff;color:#215db5;box-shadow:0 2px 7px #14315c22}
  .cam-cluster{background:#215db5;color:white;border-color:white;font:800 15px system-ui}
  .user-dot{width:14px;height:14px;background:#215db5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px #215db526}
  .leaflet-control-attribution{font:10px system-ui;background:#ffffffdd!important}
  </style></head><body><div id="map"></div><script>${leafletJS}</script><script>
  const send = data => window.ReactNativeWebView.postMessage(JSON.stringify(data));
  const initial = ${start};
  const map = L.map('map', {zoomControl:false, attributionControl:true});
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
  const dots = L.layerGroup().addTo(map);
  let user;
  function setRegion(r) {
    map.fitBounds([[r.latitude-r.latitudeDelta/2,r.longitude-r.longitudeDelta/2],[r.latitude+r.latitudeDelta/2,r.longitude+r.longitudeDelta/2]], {animate:false});
  }
  function reportRegion() {
    const center=map.getCenter(), bounds=map.getBounds();
    send({type:'region',region:{latitude:center.lat,longitude:center.lng,latitudeDelta:bounds.getNorth()-bounds.getSouth(),longitudeDelta:bounds.getEast()-bounds.getWest()}});
  }
  const paths={camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/>',activity:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>','stop-circle':'<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>'};
  window.camMap = {
    update(data) {
      dots.clearLayers();
      data.markers.forEach(p=>{
        const el=document.createElement('div');el.className='cam-pin'+(p.count>1?' cam-cluster':'');
        if(p.count>1)el.textContent=String(p.count);
        else el.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(paths[p.icon]||paths.camera)+'</svg>';
        const dot=L.marker([p.latitude,p.longitude],{title:p.title,alt:p.title,icon:L.divIcon({html:el,iconSize:[38,38],iconAnchor:[19,19],className:''})}).addTo(dots);
        const title=document.createElement('span');title.textContent=p.title;dot.bindTooltip(title);
        dot.on('click',()=>send({type:'marker',id:p.id}));
      });
      if(user)map.removeLayer(user);
      if(data.coords)user=L.marker([data.coords.latitude,data.coords.longitude],{interactive:false,icon:L.divIcon({html:'<div class="user-dot"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''})}).addTo(map);
    },
    region:setRegion,
    fit(points,padding) {
      map.fitBounds(points.map(p=>[p.latitude,p.longitude]),{maxZoom:17,paddingTopLeft:[padding.left,padding.top],paddingBottomRight:[padding.right,padding.bottom]});
    }
  };
  setRegion(initial);map.on('moveend',reportRegion);send({type:'ready'});reportRegion();
  </script></body></html>`;
}
