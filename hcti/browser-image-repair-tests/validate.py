from pathlib import Path
from PIL import Image
import numpy as np,json
root=Path('image-repair');data=json.loads((root/'browser-results.json').read_text())
for c in data:
 a=np.array(Image.open(root/(c['name']+'-semantic.png')).convert('RGB')).astype(int);r=np.array(Image.open(root/(c['name']+'-reference.png')).convert('RGB')).astype(int)
 c['canvas_pass']=a.shape==(1350,1080,3);c['reference_mae']=float(np.abs(a-r).mean());c['reference_changed_fraction']=float((np.abs(a-r).max(2)>8).mean())
 for j,x in enumerate(c['images']):
  blank=np.array(Image.open(root/(c['name']+f'-blank-{j}.png')).convert('RGB')).astype(int)
  rect=x['rect'];left=max(0,int(rect['x']));top=max(0,int(rect['y']));right=min(1080,int(rect['right']));bottom=min(1350,int(rect['bottom']));diff=np.abs(a-blank)[top:bottom,left:right]
  x['region_changed_fraction']=float((diff.max(2)>8).mean());x['pass']=bool(x['complete'] and x['naturalWidth']>0 and x['naturalHeight']>0 and x['expectedMatch'] and x['visibility']=='visible' and float(x['opacity'])>0 and x['region_changed_fraction']>.01)
 c['pass']=c['canvas_pass'] and all(x['pass'] for x in c['images']) and c['reference_mae']<1
 print(c['name'],c['pass'],'MAE',round(c['reference_mae'],4),'region',[round(x['region_changed_fraction'],3) for x in c['images']])
(root/'validation.json').write_text(json.dumps(data,indent=2))
assert all(c['pass'] for c in data)
