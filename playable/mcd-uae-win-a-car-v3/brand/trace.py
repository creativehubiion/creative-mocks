import potrace, numpy as np
from PIL import Image
def trace(mask, scale=1.0, nd=1, opttol=0.4):
    bm=potrace.Bitmap(~mask)
    plist=bm.trace(turdsize=8, alphamax=1.0, opticurve=True, opttolerance=opttol)
    f=lambda v: ('%.*f'%(nd,v*scale)).rstrip('0').rstrip('.')
    out=[]
    for curve in plist:
        sp=curve.start_point; out.append('M%s %s'%(f(sp.x),f(sp.y)))
        for seg in curve.segments:
            if seg.is_corner:
                out.append('L%s %s L%s %s'%(f(seg.c.x),f(seg.c.y),f(seg.end_point.x),f(seg.end_point.y)))
            else:
                out.append('C%s %s %s %s %s %s'%(f(seg.c1.x),f(seg.c1.y),f(seg.c2.x),f(seg.c2.y),f(seg.end_point.x),f(seg.end_point.y)))
        out.append('Z')
    return ''.join(out)
# smile: yellow pixels of the banner, cropped to the shape
b=np.array(Image.open('../../../uploads/1793278406768_McDonald_s_Banner_6.png').convert('RGB')).astype(int)
yellow=(b[:,:,0]>200)&(b[:,:,1]>150)&(b[:,:,2]<80)
yellow[680:,:]=False  # drop the copyright line
ys,xs=np.where(yellow); y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max()
m=yellow[y0:y1+1,x0:x1+1]; W=x1-x0+1; H=y1-y0+1
sm=trace(m,scale=100/W)
open('smile.path','w').write(sm); print('smile', 'viewbox 100 x %.1f'%(H*100/W), len(sm),'chars')
# wordmark: alpha of the black logo
w=np.array(Image.open('../../../uploads/1793278406768_McDonald_s_Logo_0.png').convert('RGBA'))
mask=w[:,:,3]>128
ys,xs=np.where(mask); y0,y1,x0,x1=ys.min(),ys.max(),xs.min(),xs.max(); m=mask[y0:y1+1,x0:x1+1]; W2=x1-x0+1; H2=y1-y0+1
wm=trace(m,scale=200/W2,opttol=0.6)
open('wordmark.path','w').write(wm); print('wordmark','viewbox 200 x %.1f'%(H2*200/W2), len(wm),'chars')
