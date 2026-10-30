"""Exclude mapped tunnels from the visible scenery. Core input is raw Overpass JSON.
Usage: python scripts/filter-underground-roads.py path/to/london-osm.json
Context tiles are the cached inputs from fetch-context.py. Buildings are unchanged.
"""
import json, math, sys
from pathlib import Path
import mapbox_vector_tile
ROOT=Path(__file__).resolve().parents[1]
A=math.radians(2.8);N=2**14
TILES=list((ROOT/'work/vector-tiles').glob('*.pbf'))
if not TILES:raise SystemExit('Context tile cache is missing; run fetch-context.py first.')

def world(lon,lat):
    e=(lon-.06602)*111320*math.cos(math.radians(51.505));n=(lat-51.50494)*111320
    return (round(n*math.cos(A)+e*math.sin(A),1),round(e*math.cos(A)-n*math.sin(A),1))
def signature(kind,p):return (kind,tuple(p[0]),tuple(p[-1]))
def underground(p):return p.get('tunnel') not in (None,'no',False) or p.get('location')=='underground' or p.get('brunnel')=='tunnel'
raw=json.load(open(sys.argv[1]));blocked=set()
for e in raw['elements']:
    p=e.get('tags',{});g=e.get('geometry',[])
    if len(g)>1 and p.get('highway') and underground(p):
        blocked.add(signature(p['highway'],[world(v['lon'],v['lat']) for v in g]))
path=ROOT/'public/london.json';core=json.load(open(path));before=len(core['roads'])
core['roads']=[r for r in core['roads'] if signature(*r[:2]) not in blocked]
path.write_text(json.dumps(core,separators=(',',':')))
print('Core:',before,'->',len(core['roads']))

blocked_segments=set()
for tile in TILES:
    tx,ty=map(int,tile.stem.split('-'))
    layer=mapbox_vector_tile.decode(tile.read_bytes(),default_options={'y_coord_down':True}).get('transportation')
    if not layer:continue
    extent=layer['extent']
    for f in layer['features']:
        if not underground(f['properties']):continue
        g=f['geometry'];lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates'] if g['type']=='MultiLineString' else []
        for line in lines:
            points=[]
            for x,y in line:
                lon=(tx+x/extent)/N*360-180
                lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(ty+y/extent)/N))))
                points.append(world(lon,lat))
            for a,b in zip(points,points[1:]):blocked_segments.add(tuple(sorted((a,b))))
path=ROOT/'public/context.json';context=json.load(open(path));before=len(context['roads'])
context['roads']=[r for r in context['roads'] if not any(tuple(sorted((tuple(a),tuple(b)))) in blocked_segments for a,b in zip(r[1],r[1][1:]))]
path.write_text(json.dumps(context,separators=(',',':')))
print('Context:',before,'->',len(context['roads']))
