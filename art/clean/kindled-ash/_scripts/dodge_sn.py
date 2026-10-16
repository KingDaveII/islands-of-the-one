"""ART: dodge S and N for kindled-ash, composed from SS-01 raw frames (the S and N outputs only crouch, so
the two roll frames come from the SW and NW tumbles). Each frame is moved onto a 64x64 canvas with its
output's feet (the lowest opaque row of that output's frame 0, the rotation) on row 53, cropped 2 px a
side from the 68 px v3 canvas, never scaled."""
import sys, os
from PIL import Image
R='art/raw/ss01-kindled-ash/'
PLAN={
 'S': [('dodge/south',3), ('dodge/south-west',5), ('dodge/south-west',6), ('dodge/south',8)],
 'N': [('dodge-take1/north',1), ('dodge/north-west',5), ('dodge/north-west',6), ('rotation/north',None)],
}
def feet(src):
    im=Image.open(f'{R}{src}/frame-0.png').convert('RGBA'); return im.getbbox()[3]-1
def to64(src, i):
    if i is None:
        im=Image.open(f'{R}{src}.png').convert('RGBA'); assert im.size==(64,64); return im
    im=Image.open(f'{R}{src}/frame-{i}.png').convert('RGBA'); w,h=im.size
    dy=53-feet(src); dx=-(w//2-32)
    out=Image.new('RGBA',(64,64))
    for y in range(h):
        for x in range(w):
            p=im.getpixel((x,y))
            if p[3]:
                X,Y=x+dx,y+dy
                assert 0<=X<64 and 0<=Y<64, (src,i,x,y,X,Y)
                out.putpixel((X,Y),p)
    return out

def paint_out_pale(path, box):
    """The S crouch holds a pale blob (the generator's blade turned into a ball): give its pixels the most
    common neighbouring colour that isn't pale, so the hands read as empty for the roll."""
    from collections import Counter
    im=Image.open(path).convert('RGBA'); px=im.load()
    pale=lambda p: p[3] and sum(p[:3])>600
    x0,y0,x1,y1=box
    todo=[(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1) if pale(px[x,y])]
    for _ in range(4):
        rest=[]
        for (x,y) in todo:
            c=Counter(px[x+dx,y+dy] for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if px[x+dx,y+dy][3] and not pale(px[x+dx,y+dy]) and (x+dx,y+dy) not in todo)
            if c: px[x,y]=c.most_common(1)[0][0]
            else: rest.append((x,y))
        todo=rest
    im.save(path); return len(todo)

if __name__=='__main__':
    out=sys.argv[1]
    # Written like a v3 output: frame-0 is the rotation (the ground reference), frames 1-4 the plan.
    for f,plan in PLAN.items():
        name={'S':'south','N':'north'}[f]; d=os.path.join(out,'dodge',name); os.makedirs(d,exist_ok=True)
        to64(f'rotation/{name}',None).save(os.path.join(d,'frame-0.png'))
        for n,(src,i) in enumerate(plan,1): to64(src,i).save(os.path.join(d,f'frame-{n}.png'))
    left=paint_out_pale(os.path.join(out,'dodge','south','frame-1.png'), (31, 47, 38, 52))
    assert left==0, left
