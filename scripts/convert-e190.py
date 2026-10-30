"""Convert the GPL-2.0-or-later FlightGear AC3D asset with Blender 4.3.
blender -b --python scripts/convert-e190.py -- /path/to/E-jet-family-YV public/models/e190.glb
"""
import bpy,sys,os,shlex
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]);target=str(Path(args[1]).resolve());lines=(root/'Models/erj190.ac').read_text().splitlines();pos=1;materials=[]
while lines[pos].startswith('MATERIAL'):
 t=shlex.split(lines[pos]);i=t.index('rgb');j=t.index('trans');materials.append((t[1],list(map(float,t[i+1:i+4])),float(t[j+1])));pos+=1
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);cache={}
def mat(mi,tex,name):
 key=(mi,tex,'glass' if 'Window' in name or 'Windscreen' in name else '')
 if key in cache:return cache[key]
 label,rgb,alpha=materials[mi];m=bpy.data.materials.new(label+str(len(cache)));m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.38;bs.inputs['Metallic'].default_value=.15
 if tex:
  file=root/'Models'/tex
  if tex in ['blank190.png','blank.png']:file=root/'Models/Liveries/E170/BritishAirways.png'
  image=bpy.data.images.load(str(file),check_existing=True);node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
 if key[2]:bs.inputs['Base Color'].default_value=(.018,.035,.05,1);bs.inputs['Roughness'].default_value=.15;bs.inputs['Metallic'].default_value=.35
 cache[key]=m;return m
objects=[]
def obj(inherited=None):
 global pos
 assert lines[pos].startswith('OBJECT');kind=lines[pos].split()[1];pos+=1;name=kind;tex=inherited;verts=[];faces=[];uvs=[];mis=[]
 while pos<len(lines):
  t=shlex.split(lines[pos]);pos+=1
  if not t:continue
  if t[0]=='name':name=t[1]
  elif t[0]=='texture':tex=t[1]
  elif t[0]=='data':pos+=1
  elif t[0]=='numvert':
   for _ in range(int(t[1])):
    x,y,z=map(float,lines[pos].split());pos+=1;verts.append((-z,-x,y))
  elif t[0]=='numsurf':
   for _ in range(int(t[1])):
    assert lines[pos].startswith('SURF');pos+=1;mi=0
    if lines[pos].startswith('mat '):mi=int(lines[pos].split()[1]);pos+=1
    count=int(lines[pos].split()[1]);pos+=1;face=[];uv=[]
    for k in range(count):
     v,u,w=lines[pos].split()[:3];pos+=1;face.append(int(v));uv.append((float(u),float(w)))
    if count>=3:faces.append(face);uvs.append(uv);mis.append(mi)
  elif t[0]=='kids':
   if verts and faces:
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);objects.append(o);uvlayer=mesh.uv_layers.new(name='UVMap');slots={}
    for poly,uv,mi in zip(mesh.polygons,uvs,mis):
     material=mat(mi,tex,name)
     if material.name not in slots:slots[material.name]=len(mesh.materials);mesh.materials.append(material)
     poly.material_index=slots[material.name];poly.use_smooth=True
     for li,pair in zip(poly.loop_indices,uv):uvlayer.data[li].uv=pair
   for _ in range(int(t[1])):obj(tex)
   return
obj();print('Converted objects',len(objects));bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',export_yup=True,export_materials='EXPORT');print(target)
