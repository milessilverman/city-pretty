import sys
p = "/home/user/w5/tools/osm_sites.py"
s = open(p).read()
old = '''h.apply_file(src, locations=True, idx=f"sparse_file_array,{_idxf}" if _big else "flex_mem")
if _idxf and os.path.exists(_idxf):
    os.remove(_idxf)
'''
new = '''_lock = None
if _big:
    # county builds run side by side: one disk index at a time, begun only while the disk has room for it (about 2 bytes of index per
    # byte of input: Washington's 440 MB file made an 872 MB index) and 800 MB more for the other builds; after 2 hours of waiting, stop
    import fcntl, shutil, time
    _lock = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".osm_sites_idx.lock"), "w")
    fcntl.flock(_lock, fcntl.LOCK_EX)
    _need, _t0 = 2.1 * os.path.getsize(src) + 800e6, time.time()
    while shutil.disk_usage(os.path.dirname(os.path.abspath(out))).free < _need:
        if time.time() - _t0 > 7200:
            sys.exit(f"osm_sites: {_need / 1e9:.1f} GB not free after 2 hours of waiting; node index not built")
        print(f"osm_sites: waiting for {_need / 1e9:.1f} GB free for the node index", flush=True); time.sleep(60)
try:
    h.apply_file(src, locations=True, idx=f"sparse_file_array,{_idxf}" if _big else "flex_mem")
finally:
    if _idxf and os.path.exists(_idxf):
        os.remove(_idxf)
    if _lock:
        _lock.close()
'''
assert s.count(old) == 1, s.count(old)
open(p, "w").write(s.replace(old, new))
print("patched")
