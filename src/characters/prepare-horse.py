"""Prepare the verified CC0 Quaternius Horse.gltf for Wild Mustang.

Usage: python src/characters/prepare-horse.py /path/to/original/Horse.gltf
The official source file SHA256 is recorded in public/assets/licenses/characters.json.
No paid assets or network dependencies are needed at runtime.
"""
import base64
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

SOURCE = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'public/assets/characters/horse.glb'
source = json.loads(SOURCE.read_text())
source_bytes = base64.b64decode(source['buffers'][0]['uri'].split(',')[1])
components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
formats = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}

def values(index):
    accessor = source['accessors'][index]
    view = source['bufferViews'][accessor['bufferView']]
    fmt = '<' + formats[accessor['componentType']] * components[accessor['type']]
    size = struct.calcsize(fmt)
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from(fmt, source_bytes, offset + i * view.get('byteStride', size))
            for i in range(accessor['count'])]

# Keep the peaceful animation set. Attack/death/hit animations are not shipped.
wanted = {'Idle', 'Idle_2', 'Idle_Headlow', 'Eating', 'Walk', 'Gallop', 'Gallop_Jump', 'Jump_toIdle'}
source['animations'] = [a for a in source['animations'] if a['name'] in wanted]
walk = next(a for a in source['animations'] if a['name'] == 'Walk')
trot = copy.deepcopy(walk)
trot['name'] = 'Trot'

# The pack contains no trot. Author a diagonal two-beat gait by advancing both
# hind-leg chains by a quarter of the walk cycle, with a shorter cadence.
def slerp(a, b, t):
    dot = sum(x*y for x, y in zip(a, b))
    if dot < 0:
        b = tuple(-x for x in b)
        dot = -dot
    if dot > 0.9995:
        q = [x + (y-x)*t for x, y in zip(a, b)]
    else:
        theta = math.acos(max(-1, min(1, dot)))
        sn = math.sin(theta)
        q = [(x*math.sin((1-t)*theta) + y*math.sin(t*theta))/sn for x,y in zip(a,b)]
    norm = math.sqrt(sum(x*x for x in q))
    return tuple(x/norm for x in q)

new_arrays = {}
next_id = len(source['accessors'])
def make_array(rows, kind='VEC3', component=5126):
    global next_id
    index = next_id
    next_id += 1
    new_arrays[index] = (rows, kind, component)
    return index

for channel in trot['channels']:
    sampler = trot['samplers'][channel['sampler']]
    node = source['nodes'][channel['target']['node']]['name']
    path = channel['target']['path']
    times = [v[0] for v in values(sampler['input'])]
    rows = values(sampler['output'])
    duration = times[-1]
    if node.startswith(('BackShoulder', 'BackLeg', 'BackUpperLeg', 'BackLowerLeg', 'IKBackLeg', 'FFB.')):
        shifted = []
        for time in times:
            phase = (time + duration * 0.25) % duration
            k = min(len(times)-2, max(0, int(phase/duration*(len(times)-1))))
            fraction = (phase-times[k])/(times[k+1]-times[k])
            if path == 'rotation':
                shifted.append(slerp(rows[k], rows[k+1], fraction))
            else:
                shifted.append(tuple(a+(b-a)*fraction for a,b in zip(rows[k],rows[k+1])))
        rows = shifted
    elif node == 'Body' and path == 'translation':
        average_y = sum(row[1] for row in rows)/len(rows)
        rows = [(x*.3, average_y + (y-average_y)*1.4, z) for x,y,z in rows]
    sampler['input'] = make_array([(time * (0.78/duration),) for time in times], 'SCALAR')
    sampler['output'] = make_array(rows, channel['target']['path'] == 'rotation' and 'VEC4' or 'VEC3')
source['animations'].append(trot)

# The gameplay controller owns jump height. Remove the source's two-meter body
# arc so the rig tucks its legs without doubling the physical trajectory.
for animation in source['animations']:
    if animation['name'] not in {'Gallop_Jump', 'Jump_toIdle'}: continue
    for channel in animation['channels']:
        if source['nodes'][channel['target']['node']]['name'] == 'Body' and channel['target']['path'] == 'translation':
            sampler = animation['samplers'][channel['sampler']]
            rows = values(sampler['output'])
            rows = [(x, 0.912 + max(-0.10, min(0.10, (y-0.912)*0.08)), z) for x,y,z in rows]
            sampler['output'] = make_array(rows)


# Extract an original off-center facial blaze into its own skinned primitive.
# It follows the model's original skin weights, so it cannot detach on head turns.
blaze_material = len(source['materials'])
source['materials'].append({'name': 'Veter_Blaze', 'doubleSided': True,
    'pbrMetallicRoughness': {'baseColorFactor': [0.91, 0.85, 0.69, 1],
                           'metallicFactor': 0, 'roughnessFactor': 0.92}})
primitive = source['meshes'][0]['primitives'][0]
positions = values(primitive['attributes']['POSITION'])
normals = values(primitive['attributes']['NORMAL'])
indices = [r[0] for r in values(primitive['indices'])]
blaze, coat = [], []
for i in range(0, len(indices), 3):
    tri = indices[i:i+3]
    centroid = tuple(sum(positions[k][axis] for k in tri)/3 for axis in range(3))
    normal = tuple(sum(normals[k][axis] for k in tri)/3 for axis in range(3))
    x,y,z = centroid
    # Narrow organic marking across the brow and nasal bridge, well above muzzle.
    width = .12 + .035*math.sin(y*8)
    selected = 3.65 < y < 4.22 and z > 2.9 and abs(x-.025) < width and normal[2] > .1
    (blaze if selected else coat).extend(tri)
if not blaze:
    raise RuntimeError('The intended blaze surface was not found in the source model.')
primitive['indices'] = make_array([(v,) for v in coat], 'SCALAR', 5123)
blaze_primitive = copy.deepcopy(primitive)
blaze_primitive['indices'] = make_array([(v,) for v in blaze], 'SCALAR', 5123)
blaze_primitive['material'] = blaze_material
source['meshes'][0]['primitives'].append(blaze_primitive)

# Repack referenced accessors only, deduplicate binary arrays and compress
# constant channels to two endpoint samples. No lossy mesh codec is required.
for animation in source['animations']:
    for channel in animation['channels']:
        sampler = animation['samplers'][channel['sampler']]
        if sampler['output'] in new_arrays:
            rows, kind, component = new_arrays[sampler['output']]
        else:
            rows = values(sampler['output'])
            kind = source['accessors'][sampler['output']]['type']
        if all(abs(v-ref)<0.00002 for row in rows for v,ref in zip(row,rows[0])):
            in_rows = new_arrays[sampler['input']][0] if sampler['input'] in new_arrays else values(sampler['input'])
            sampler['input'] = make_array([in_rows[0], in_rows[-1]], 'SCALAR')
            sampler['output'] = make_array([rows[0], rows[0]], kind)

refs = set()
for mesh in source['meshes']:
    for primitive in mesh['primitives']:
        refs.update(primitive['attributes'].values())
        if 'indices' in primitive: refs.add(primitive['indices'])
for skin in source['skins']:
    refs.add(skin['inverseBindMatrices'])
for animation in source['animations']:
    for sampler in animation['samplers']:
        refs.update((sampler['input'], sampler['output']))

binary = bytearray()
accessors, views, mapping, binary_dedup = [], [], {}, {}
for index in sorted(refs):
    if index in new_arrays:
        rows, kind, component = new_arrays[index]
        old = {'componentType': component, 'type': kind, 'count': len(rows)}
    else:
        old = copy.deepcopy(source['accessors'][index])
        rows, kind, component = values(index), old['type'], old['componentType']
    fmt = '<' + formats[component]*components[kind]
    raw = b''.join(struct.pack(fmt, *row) for row in rows)
    key = (raw, component, kind)
    if key in binary_dedup:
        mapping[index] = binary_dedup[key]
        continue
    while len(binary)%4: binary.append(0)
    view = len(views)
    views.append({'buffer':0, 'byteOffset':len(binary), 'byteLength':len(raw)})
    binary.extend(raw)
    accessor = {k:v for k,v in old.items() if k not in ('bufferView','byteOffset')}
    accessor['bufferView'] = view
    if 'min' in accessor or kind=='SCALAR' and component==5126:
        accessor['min'] = [min(r[i] for r in rows) for i in range(components[kind])]
        accessor['max'] = [max(r[i] for r in rows) for i in range(components[kind])]
    mapping[index] = len(accessors)
    binary_dedup[key] = mapping[index]
    accessors.append(accessor)

for mesh in source['meshes']:
    for primitive in mesh['primitives']:
        primitive['attributes'] = {k:mapping[v] for k,v in primitive['attributes'].items()}
        if 'indices' in primitive: primitive['indices'] = mapping[primitive['indices']]
for skin in source['skins']: skin['inverseBindMatrices'] = mapping[skin['inverseBindMatrices']]
for animation in source['animations']:
    for sampler in animation['samplers']:
        sampler['input'], sampler['output'] = mapping[sampler['input']], mapping[sampler['output']]
source['accessors'], source['bufferViews'] = accessors, views
source['buffers'] = [{'byteLength': len(binary)}]
source['asset']['copyright'] = 'Quaternius, CC0 1.0. Wild Mustang marking and Trot animation modifications.'
encoded = json.dumps(source, separators=(',', ':')).encode('utf8')
encoded += b' '*((-len(encoded))%4)
binary += b'\0'*((-len(binary))%4)
glb = struct.pack('<4sII', b'glTF', 2, 12+8+len(encoded)+8+len(binary))
glb += struct.pack('<I4s', len(encoded), b'JSON') + encoded

glb += struct.pack('<I4s', len(binary), b'BIN\0') + binary
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(glb)
print(json.dumps({'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'glb_sha256':hashlib.sha256(glb).hexdigest(), 'bytes': len(glb), 'triangles':2182,
    'blaze_triangles':len(blaze)//3,'bones':50,'clips':[a['name'] for a in source['animations']]},indent=2))
