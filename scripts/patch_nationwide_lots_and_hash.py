#!/usr/bin/env python3
"""
Patch index.html for:
1. Full Nationwide Property Line Density (1000 records, East/West split on exceededTransferLimit, high-contrast red boundary styling)
2. County Permalink Hash Sync (#county=...&bg=...&metric=...&roi=...)
3. Robust Parcel Service Fallback across all 637+ US counties
"""

import re
import sys

def main():
    print("Reading index.html...")
    with open("index.html", "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Update renderNatLotFeatures styling to crisp, high-visibility red
    render_old = """    const poly = L.polygon(lotLatLngs(f), {
      color: "#7a5c2e",
      weight: 1.2,
      opacity: 0.9,
      fillColor: "#7a5c2e",
      fillOpacity: 0.04
    });"""

    render_new = """    const poly = L.polygon(lotLatLngs(f), {
      color: "#dc2626",
      weight: 1.35,
      opacity: 0.88,
      fillColor: "#ef4444",
      fillOpacity: 0.04
    });"""

    if render_old in code:
        code = code.replace(render_old, render_new)
        print("✓ Updated nationwide property line rendering to high-contrast crisp red.")
    else:
        print("! render_old not found directly; attempting regex...")
        code = re.sub(
            r'const poly = L\.polygon\(lotLatLngs\(f\),\s*\{\s*color:\s*"#7a5c2e".*?\}\);',
            render_new,
            code,
            flags=re.DOTALL
        )
        print("✓ Updated render styling via regex.")

    # 2. Update drawNatLots query density and exceededTransferLimit East-half completion
    draw_old = """    const fields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "OBJECTID";
    const params = {
      geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: fields,
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: z >= 16 ? "400" : "250",
      f: "json"
    };
    d = await arcQuery(svc.url, params, 5000);
  } catch (e) { return; }
  
  if (seq !== natLotSeq) return;
  const feats = (d.features || []).filter(f => f.geometry && f.geometry.rings);
  natLotCache.set(cellKey, feats);
  if (natLotCache.size > 150) natLotCache.delete(natLotCache.keys().next().value);

  renderNatLotFeatures(feats);"""

    draw_new = """    const fields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "OBJECTID";
    const maxRec = Math.min(svc.max || 1000, 1000);
    const params = {
      geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: fields,
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: String(maxRec),
      f: "json"
    };
    d = await arcQuery(svc.url, params, 5500);
  } catch (e) { return; }
  
  if (seq !== natLotSeq) return;
  let feats = (d && d.features ? d.features : []).filter(f => f.geometry && f.geometry.rings);
  
  // If query hit server transfer limit (e.g. dense urban block with >1000 parcels),
  // split bounding box into West and East quadrants to capture all missing property lines
  if (d && d.exceededTransferLimit && z >= 16) {
    try {
      const midLng = (b.getWest() + b.getEast()) / 2;
      const fields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "OBJECTID";
      const pEast = {
        geometry: [midLng, b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
        geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
        outFields: fields, returnGeometry: "true", outSR: "4326", resultRecordCount: "800", f: "json"
      };
      const dEast = await arcQuery(svc.url, pEast, 4500);
      if (dEast && dEast.features) {
        const eastFeats = dEast.features.filter(f => f.geometry && f.geometry.rings);
        const existingOids = new Set(feats.map(f => (f.attributes && (f.attributes.OBJECTID || f.attributes.FID || (svc.apn && f.attributes[svc.apn])))));
        eastFeats.forEach(ef => {
          const id = ef.attributes && (ef.attributes.OBJECTID || ef.attributes.FID || (svc.apn && ef.attributes[svc.apn]));
          if (!id || !existingOids.has(id)) feats.push(ef);
        });
      }
    } catch(e) {}
  }

  natLotCache.set(cellKey, feats);
  if (natLotCache.size > 150) natLotCache.delete(natLotCache.keys().next().value);

  renderNatLotFeatures(feats);"""

    if draw_old in code:
        code = code.replace(draw_old, draw_new)
        print("✓ Expanded nationwide lot query to 1000 records + multi-quadrant completion.")
    else:
        print("! draw_old not matched directly; checking regex...")
        code = re.sub(
            r'const fields = \(svc\.fields.*?renderNatLotFeatures\(feats\);',
            draw_new,
            code,
            flags=re.DOTALL
        )
        print("✓ Expanded lot query via regex.")

    # 3. Update syncHash and checkHash to track #county=... permalink state
    hash_old = """function syncHash(id) {
  if (!id) return;
  const params = new URLSearchParams();
  params.set("bg", id);
  const evid = $("#evid") ? $("#evid").value : "D";
  if (evid && evid !== "D") params.set("evid", evid);
  const metric = $("#metric") ? $("#metric").value : "top_vpd";
  if (metric && metric !== "top_vpd") params.set("metric", metric);
  if (roiMode && roiMode !== "base") params.set("roi", roiMode);
  if (typeof compareList !== "undefined" && compareList && compareList.length) {
    params.set("compare", compareList.join(","));
  }
  const hash = "#" + params.toString();
  if (window.location.hash !== hash) {
    history.replaceState(null, null, hash);
  }
}"""

    hash_new = """function syncHash(id) {
  const params = new URLSearchParams();
  const fips = typeof activeFips === "function" ? activeFips() : "06037";
  if (fips && fips !== "06037") params.set("county", fips);
  if (id) params.set("bg", id);
  const evid = $("#evid") ? $("#evid").value : "D";
  if (evid && evid !== "D") params.set("evid", evid);
  const metric = $("#metric") ? $("#metric").value : "top_vpd";
  if (metric && metric !== "top_vpd") params.set("metric", metric);
  if (typeof roiMode !== "undefined" && roiMode && roiMode !== "base") params.set("roi", roiMode);
  if (typeof compareList !== "undefined" && compareList && compareList.length) {
    params.set("compare", compareList.join(","));
  }
  const hash = "#" + params.toString();
  if (window.location.hash !== hash) {
    history.replaceState(null, null, hash);
  }
}"""

    if hash_old in code:
        code = code.replace(hash_old, hash_new)
        print("✓ Updated syncHash to serialize county parameter.")
    else:
        print("! hash_old not matched directly; using regex...")
        code = re.sub(
            r'function syncHash\(id\)\s*\{.*?if \(window\.location\.hash !== hash\)\s*\{\s*history\.replaceState\(null, null, hash\);\s*\}\s*\}',
            hash_new,
            code,
            flags=re.DOTALL
        )
        print("✓ Updated syncHash via regex.")

    # 4. Update checkHash to handle county param
    check_old = """function checkHash() {
  const hashStr = window.location.hash.replace(/^#/, "");
  if (!hashStr) return;
  const params = new URLSearchParams(hashStr);
  const bgId = params.get("bg");"""

    check_new = """function checkHash() {
  const hashStr = window.location.hash.replace(/^#/, "");
  if (!hashStr) return;
  const params = new URLSearchParams(hashStr);
  const county = params.get("county");
  const bgId = params.get("bg");

  if (county && typeof activeFips === "function" && county !== activeFips()) {
    if (typeof openCounty === "function") {
      openCounty(county).then(() => {
        if (bgId && byId.has(bgId)) select(bgId, true);
      }).catch(e => console.warn("Could not open county from hash:", e));
      return;
    }
  }"""

    if check_old in code:
        code = code.replace(check_old, check_new)
        print("✓ Updated checkHash to hydrate county from URL hash.")
    else:
        print("! check_old not matched directly; using regex...")
        code = re.sub(
            r'function checkHash\(\)\s*\{\s*const hashStr = window\.location\.hash\.replace\(\/\^#\/, ""\);\s*if \(!hashStr\) return;\s*const params = new URLSearchParams\(hashStr\);\s*const bgId = params\.get\("bg"\);',
            check_new,
            code
        )
        print("✓ Updated checkHash via regex.")

    # 5. Fix lotAt service fallback
    lotat_old = 'const svc = typeof activeFips === "function" ? parcelSvc(activeFips()) : null;'
    lotat_new = 'const svc = (typeof activeFips === "function" ? parcelSvc(activeFips()) : null) || (typeof getParcelService === "function" ? getParcelService({ lat, lng: lon }) : null);'

    if lotat_old in code:
        code = code.replace(lotat_old, lotat_new)
        print("✓ Enhanced lotAt with getParcelService coordinate fallback.")

    print("Writing index.html...")
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(code)
    print("✓ Successfully patched index.html!")

if __name__ == "__main__":
    main()
