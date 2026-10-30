"""Fetch CC0 Poly Haven ground PBR assets; cache metadata in work/."""
import json,subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/textures/ground';OUT.mkdir(parents=True,exist_ok=True)
def fetch(asset):
 p=ROOT/'work'/(asset+'-files.json')
 subprocess.run(['curl','-sfL','--retry','2','--max-time','40','https://api.polyhaven.com/files/'+asset,'-o',str(p)],check=True)
 d=json.load(open(p))
 for key,name in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
  url=d[key]['1k']['jpg']['url']
  subprocess.run(['curl','-sfL','--retry','2','--max-time','40',url,'-o',str(OUT/(asset+'-'+name+'.jpg'))],check=True)
 print(asset,flush=True)
with ThreadPoolExecutor(3) as pool:list(pool.map(fetch,['clean_asphalt','concrete_floor_02','leafy_grass']))
