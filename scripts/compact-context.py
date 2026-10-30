import json,math,concurrent.futures
from collections import defaultdict
from shapely.geometry import Polygon
from shapely.ops import unary_union
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
src=json.load(open(ROOT/'work/context-full.json'))['buildings'];groups=defaultdict(list);out=[]
for h,p,t in src:
 cx=sum(v[0]for v in p)/len(p);cz=sum(v[1]for v in p)/len(p)
 if math.hypot(cx,cz+3500)>10500:continue
 shape=Polygon(p)
 if not shape.is_valid:shape=shape.buffer(0)
 if shape.is_empty:continue
 if h>24:out.append([h,p,t]);continue
 tier=max(6,round(h/3)*3);groups[(int(cx//700),int(cz//700),tier)].append(shape)
def merge(item):
 (_,_,h),polys=item
 union=unary_union([p.buffer(.18,join_style=2)for p in polys]).simplify(.65,preserve_topology=True)
 ps=list(union.geoms)if hasattr(union,'geoms')else[union]
 return [[h,[[round(x,1),round(y,1)]for x,y in p.exterior.coords],'yes']for p in ps if p.geom_type=='Polygon' and p.area>10]
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
 for i,parts in enumerate(pool.map(merge,groups.items())):
  out.extend(parts)
  if i%100==0:print('Groups',i,'buildings',len(out),flush=True)
json.dump({'buildings':out},open(ROOT/'public/context.json','w'),separators=(',',':'))
print('Reduced',len(src),'to',len(out),'vertices',sum(len(b[1])for b in out))
