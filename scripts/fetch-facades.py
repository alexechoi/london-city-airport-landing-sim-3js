"""Fetch CC0 ambientCG facades and pack linear AO/roughness/metalness into RGB.
Requires curl and Pillow. Download archives are cached in work/facade-zips.
"""
from pathlib import Path
import zipfile,subprocess
from PIL import Image
import io
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'work/facade-zips';CACHE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public/textures/facades';OUT.mkdir(parents=True,exist_ok=True)
for name in ['Facade001','Facade005','Facade006','Facade018A','Facade019A','Facade020A']:
    path=CACHE/(name+'.zip')
    if not path.exists():subprocess.run(['curl','-sfL','--retry','2','--max-time','45','https://ambientcg.com/get?file='+name+'_1K-JPG.zip','-o',str(path)],check=True)
    with zipfile.ZipFile(path) as z:
        prefix=name+'_1K-JPG_'
        for kind in ['Color','NormalGL']:(OUT/(name+'-'+kind+'.jpg')).write_bytes(z.read(prefix+kind+'.jpg'))
        rough=Image.open(io.BytesIO(z.read(prefix+'Roughness.jpg'))).convert('L')
        metal=Image.open(io.BytesIO(z.read(prefix+'Metalness.jpg'))).convert('L')
        ao=Image.open(io.BytesIO(z.read(prefix+'AmbientOcclusion.jpg'))).convert('L') if prefix+'AmbientOcclusion.jpg' in z.namelist() else Image.new('L',rough.size,255)
        Image.merge('RGB',(ao,rough,metal)).save(OUT/(name+'-ORM.png'),optimize=True)
        print(name,flush=True)
