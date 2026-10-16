"""ART: hand-drawn heavy N frames for kindled-ash (charge 3, thrust 2, hold 1, recover 2), built on the
N rotation (64x64, soles on row 53). Facing away, the right hand is on the viewer's right."""
import sys, math
from PIL import Image
OUT=(0x1C,0x21,0x47,255); IRON=(0x4A,0x4E,0x57,255); STONE=(0x7D,0x87,0x94,255); SHELL=(0xE8,0xE2,0xD6,255)
SAIL=(0x8C,0x7F,0x6E,255); TAR=(0x5E,0x54,0x48,255); LEATHER=(0x8A,0x64,0x20,255)
def blade(px, hand, ang, n=11):
    """Hookblade from the hand along angle (degrees, 0 = up, 90 = right), steel ramp, dream-night outline."""
    dx, dy = math.sin(math.radians(ang)), -math.cos(math.radians(ang))
    pts=[(round(hand[0]+dx*i), round(hand[1]+dy*i)) for i in range(1, n+1)]
    new={}
    for i,p in enumerate(pts): new[p]=LEATHER if i<2 else STONE
    lx, ly = -dy, dx   # left of the direction
    for p in pts[3:-2]: new.setdefault((round(p[0]+(-1 if lx>=0 else 1)*0+(-1)), p[1]) if abs(dy)>=abs(dx) else (p[0], p[1]-1), SHELL)
    tip=pts[-1]
    hook=[(round(tip[0]+dx-lx), round(tip[1]+dy-ly)), (round(tip[0]-2*lx), round(tip[1]-2*ly)), (round(tip[0]-2*lx-dx), round(tip[1]-2*ly-dy))]
    for p in hook: new[p]=STONE
    for p,c in new.items(): px[p]=c
    for (x,y) in list(new):
        for ox in (-1,0,1):
            for oy in (-1,0,1):
                q=(x+ox,y+oy)
                if q not in new and q not in px: px[q]=OUT
def hand(px, at):
    x,y=at
    for p,c in {(x,y):SAIL,(x+1,y):SAIL,(x,y+1):TAR,(x+1,y+1):TAR}.items(): px[p]=c
    for (x0,y0) in [(x,y),(x+1,y),(x,y+1),(x+1,y+1)]:
        for ox in (-1,0,1):
            for oy in (-1,0,1):
                q=(x0+ox,y0+oy)
                if q not in px: px[q]=OUT
def sleeve(px, a, b):
    """A 3 px wide soot sleeve from a to b, outlined."""
    n=max(abs(b[0]-a[0]),abs(b[1]-a[1]))
    pts=[(round(a[0]+(b[0]-a[0])*i/n), round(a[1]+(b[1]-a[1])*i/n)) for i in range(n+1)]
    new=set()
    for (x,y) in pts:
        for ox in (-1,0,1): new.add((x+ox,y))
    for p in new: px[p]=IRON
    for (x,y) in list(new):
        for ox in (-1,0,1):
            for oy in (-1,0,1):
                q=(x+ox,y+oy)
                if q not in new and (q not in px or px[q]==OUT): px.setdefault(q,OUT)
def load(p):
    im=Image.open(p).convert('RGBA'); return {(x,y):im.getpixel((x,y)) for y in range(64) for x in range(64) if im.getpixel((x,y))[3]}
def save(px, path):
    im=Image.new('RGBA',(64,64))
    for (x,y),c in px.items():
        assert 0<=x<64 and 0<=y<64, (x,y); im.putpixel((x,y),c)
    im.save(path)
def frames(base):
    F={}
    # charge: the hand drops behind the right hip, the blade swings further back (down and out) each frame
    for i,(h,a) in enumerate([((44,40),165),((45,41),140),((45,42),120)]):
        px=dict(base); hand(px,h); blade(px,(h[0],h[1]+1),a,10); F[f'heavy_charge/N/frame-{i}']=px
    # thrust: the arm goes up past the hood (forward, away from the viewer); the blade points up
    for i,(h,a,n) in enumerate([((42,17),15,8),((41,13),5,10)]):
        px=dict(base); sleeve(px,(40,24),(h[0],h[1]+2)); blade(px,h,a,n); hand(px,h); F[f'heavy_thrust/N/frame-{i}']=px
    F['heavy_hold/N/frame-0']=dict(F['heavy_thrust/N/frame-1'])
    px=dict(base); sleeve(px,(40,24),(43,20)); blade(px,(43,18),40,9); hand(px,(43,18)); F['heavy_recover/N/frame-0']=px
    px=dict(base); hand(px,(44,38)); blade(px,(44,39),170,9); F['heavy_recover/N/frame-1']=px
    return F
ORDER=['heavy_charge/N/frame-0','heavy_charge/N/frame-1','heavy_charge/N/frame-2','heavy_thrust/N/frame-0',
       'heavy_thrust/N/frame-1','heavy_hold/N/frame-0','heavy_recover/N/frame-0','heavy_recover/N/frame-1']
if __name__=='__main__':
    # Written like a v3 output: frame-0 is the N rotation (the ground reference), frames 1-8 in ORDER.
    src, outdir = sys.argv[1], sys.argv[2]
    import os
    base=load(src); F=frames(base); d=os.path.join(outdir,'heavy','north'); os.makedirs(d,exist_ok=True)
    save(base, os.path.join(d,'frame-0.png'))
    for n,name in enumerate(ORDER, 1): save(F[name], os.path.join(d,f'frame-{n}.png'))
