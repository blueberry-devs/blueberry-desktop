from pathlib import Path
from PIL import Image

src = Path(r'C:\Users\rytp8\coding\music\resources\moods')

for png in sorted(src.glob('*.png')):
    avif = png.with_suffix('.avif')
    if avif.exists():
        print(f'  SKIP {avif.name} (already exists)')
        continue
    img = Image.open(png).convert('RGBA')
    img.save(avif, format='AVIF', quality=80)
    print(f'  OK   {png.name} -> {avif.name}')

print('Done')
