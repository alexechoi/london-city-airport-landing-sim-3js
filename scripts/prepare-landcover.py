"""Create the CC BY 4.0 land-cover mask from the attributed EOX image.
Run from repository root with Python 3 and Pillow installed.
This is an approximate vegetation classifier, not a surveyed land-use dataset.
"""
from PIL import Image, ImageFilter

source = Image.open('public/textures/london-satellite.jpg').resize((2048, 1024))
mask = Image.new('RGB', source.size)
pixels = []
for red, green, blue in source.getdata():
    vegetation = max(0, min(1, ((green-red)*2 + (green-blue)*0.6 - 4)/25))
    value = round(vegetation*255)
    pixels.append((value, value, value))
mask.putdata(pixels)
mask.filter(ImageFilter.GaussianBlur(1.2)).save('public/textures/landcover.jpg', quality=88)
