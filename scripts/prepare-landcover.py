"""Build vegetation (R) and broad surface brightness (G) from CC BY 4.0 EOX imagery.
Run with --download to refresh the source using the same bounds as the renderer.
This is an approximate classifier, not a surveyed land-use dataset.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlretrieve
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[1]
bounds = json.loads((root / 'src/landcover-bounds.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--download', action='store_true')
args = parser.parse_args()
path = root / 'public/textures/london-satellite.jpg'
if args.download:
    query = urlencode(dict(service='WMS', request='GetMap', version='1.1.1',
        layers='s2cloudless-2024', styles='', format='image/jpeg', srs='EPSG:4326',
        bbox=','.join(str(bounds[k]) for k in ['west','south','east','north']),
        width=bounds['width'], height=bounds['height']))
    urlretrieve('https://tiles.maps.eox.at/wms?' + query, path)
source = Image.open(path).convert('RGB')
assert source.size == (bounds['width'], bounds['height']), 'Source bounds/resolution mismatch'
source = source.resize((2048,1152), Image.Resampling.LANCZOS)
mask = Image.new('RGB', source.size)
pixels = []
for red, green, blue in source.getdata():
    vegetation = max(0, min(1, ((green-red)*2 + (green-blue)*0.6 - 4)/25))
    brightness = round(.2126*red + .7152*green + .0722*blue)
    pixels.append((round(vegetation*255), brightness, 0))
mask.putdata(pixels)
mask.filter(ImageFilter.GaussianBlur(.7)).save(root / 'public/textures/landcover.jpg', quality=94, subsampling=0)
