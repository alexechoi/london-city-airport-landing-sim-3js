"""Rebuild mapped context. Requires curl, mapbox-vector-tile and shapely. Run compact-context.py afterwards."""
import math,json,subprocess,concurrent.futures
from pathlib import Path
import mapbox_vector_tile
from shapely.geometry import Polygon
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'work/vector-tiles';CACHE.mkdir(parents=True,exist_ok=True)
Z=14;N=2**Z;A=math.radians(2.8)
def tile(lon,lat):return int((lon+180)/360*N),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N)
x0,y0=tile(-.16,51.56);x1,y1=tile(.15,51.455)
url='https://tiles.openfreemap.org/planet/20261025_080012_pt/{z}/{x}/{y}.pbf'
def fetch(t):
 x,y=t;p=CACHE/f'{x}-{y}.pbf'
 if not p.exists():subprocess.run(['curl','-sfL','--retry','2','--max-time','40',url.format(z=Z,x=x,y=y),'-o',str(p)],check=True)
 return x,y,mapbox_vector_tile.decode(p.read_bytes(),default_options={'y_coord_down':True})
def world(x,y,extent,tx,ty):
 lon=(tx+x/extent)/N*360-180;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(ty+y/extent)/N))))
 e=(lon-.06602)*111320*math.cos(math.radians(51.505));n=(lat-51.50494)*111320
 return [round(n*math.cos(A)+e*math.sin(A),1),round(e*math.cos(A)-n*math.sin(A),1)]
def rings(feature,ext,tx,ty):
 g=feature['geometry'];poly=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']] if g['type']=='Polygon' else []
 return [[[world(x,y,ext,tx,ty)for x,y in ring]for ring in p]for p in poly]
buildings=[];waters=[];parks=[];seen=set()
with concurrent.futures.ThreadPoolExecutor(max_workers=5)as pool:
 for i,(tx,ty,data)in enumerate(pool.map(fetch,[(x,y)for x in range(x0,x1+1)for y in range(y0,y1+1)])):
  for layer in ['building','water','landcover','landuse']:
   if layer not in data:continue
   ext=data[layer]['extent']
   for f in data[layer]['features']:
    prop=f['properties'];kind=prop.get('class','');fid=(layer,f.get('id',0))
    if layer=='building' and fid[1] and fid in seen:continue
    if layer=='building':seen.add(fid)
    if layer in ['landcover','landuse'] and kind not in ['wood','grass','forest','park','recreation_ground','meadow','grassland','garden']:continue
    for polygon in rings(f,ext,tx,ty):
     if len(polygon[0])<4:continue
     shape=Polygon(polygon[0],polygon[1:]);shape=shape if shape.is_valid else shape.buffer(0)
     if shape.is_empty:continue
     if layer=='building':
      cx,cz=shape.centroid.coords[0];e=cz*math.cos(A)+cx*math.sin(A);n=cx*math.cos(A)-cz*math.sin(A);lon=.06602+e/(111320*math.cos(math.radians(51.505)));lat=51.50494+n/111320
      if -.051<lon<.111 and 51.479<lat<51.531:continue
      if prop.get('hide_3d'):continue
      h=max(4,min(310,prop.get('render_height',6)))
      buildings.append([round(h,1),polygon[0],'house' if h<12 else 'yes'])
     elif layer=='water':waters.append(shape)
     else:parks.append(shape)
  if i%10==0:print('Tiles',i,'buildings',len(buildings),flush=True)
def compact(polys,min_area=8,max_distance=None):
 merged=unary_union(polys).simplify(.6,preserve_topology=True)
 items=list(merged.geoms)if hasattr(merged,'geoms')else[merged]
 return [{'outer':[[round(x,1),round(y,1)]for x,y in p.exterior.coords],'holes':[[[round(x,1),round(y,1)]for x,y in r.coords]for r in p.interiors]}for p in items if p.geom_type=='Polygon' and p.area>min_area and (max_distance is None or math.hypot(p.centroid.x,p.centroid.y+3500)<max_distance)]
json.dump({'buildings':buildings},open(ROOT/'work/context-full.json','w'),separators=(',',':'))
json.dump(compact(waters),open(ROOT/'public/water.json','w'),separators=(',',':'))
json.dump(compact(parks,400,10000),open(ROOT/'public/parks.json','w'),separators=(',',':'))
print('DONE',len(buildings),'context buildings',len(waters),'water polygons',len(parks),'green areas')
