from PIL import Image, ImageDraw
from pathlib import Path
base = Path(__file__).resolve().parent.parent / 'public' / 'icons'
base.mkdir(parents=True, exist_ok=True)

def icon(sz):
    S = sz * 4
    img = Image.new('RGB', (S,S), '#6d45ef')
    d = ImageDraw.Draw(img)
    u = S/512
    rect = lambda a,b,c,e,**kw: d.rounded_rectangle((int(a*u),int(b*u),int(c*u),int(e*u)),**kw)
    polygon = lambda xy, fill: d.polygon([(int(x*u),int(y*u)) for x,y in xy],fill=fill)
    ellipse = lambda a,b,c,e,fill: d.ellipse((int(a*u),int(b*u),int(c*u),int(e*u)),fill=fill)
    rect(86,125,394,435,radius=int(70*u),fill='#8e73ff')
    rect(100,97,408,407,radius=int(70*u),fill='#ffffff')
    rect(145,177,345,216,radius=int(18*u),fill='#e8deff')
    rect(145,241,290,282,radius=int(18*u),fill='#e8deff')
    rect(145,307,266,348,radius=int(18*u),fill='#e8deff')
    # check mark
    polygon([(269,281),(302,311),(372,224),(393,247),(304,358),(248,301)], '#34bc82')
    # yellow sparkle at top right
    polygon([(393,65),(406,101),(443,114),(406,127),(393,164),(380,127),(343,114),(380,101)], '#ffe884')
    ellipse(57,319,75,337,'#bba5ff')
    ellipse(442,347,462,367,'#bba5ff')
    return img.resize((sz,sz),Image.Resampling.LANCZOS)

for sz in (192,512): icon(sz).save(base / f'icon-{sz}.png',optimize=True)
icon(96).save(base/'badge-96.png', optimize=True)
