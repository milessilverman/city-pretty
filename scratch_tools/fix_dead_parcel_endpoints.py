import re
import json

FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Kent County, MI (26081)
old_kent = '{"url": "https://gis.kentcountymi.gov/agisprod/rest/services/ParcelsWithCondos/FeatureServer/0", "states": ["MI"], "counties": ["26081"], "name": "Kent County GIS Parcels", "terms": "https://gis.kentcountymi.gov/agisprod/rest/services/ParcelsWithCondos/FeatureServer/0", "addr": "PROPERTYADDRESS", "apn": "PNUM", "max": 2000, "fields": [["PNUM", "Parcel ID"], ["PROPERTYADDRESS", "Site Address"]]}'
new_kent = '{"url": "https://gisportalgr.grcity.us/arcgis/rest/services/Core_Data/Parcels/MapServer/1", "states": ["MI", "26"], "counties": ["26081"], "name": "Kent County & Grand Rapids GIS Parcels", "terms": "https://gisportalgr.grcity.us/arcgis/rest/services/Core_Data/Parcels/MapServer/1", "addr": "PROPERTYADDRESS", "apn": "PPN_TEXT", "max": 2000, "fields": [["PPN_TEXT", "Parcel ID"], ["PROPERTYADDRESS", "Site Address"], ["PROPERTYCLASS", "Use Class"], ["TAXABLETRIBUNAL1", "Taxable Value"], ["ACREAGE", "Acreage"], ["INROW_FLAG", "In-ROW"]]}'

if old_kent in content:
    content = content.replace(old_kent, new_kent, 1)
    print("Replaced Kent County, MI parcel endpoint successfully")
else:
    print("WARNING: old_kent not found")

# 2. Wayne County, MI (26163)
old_wayne = 'https://www.waynecounty.com/gisserver/rest/services/ParcelViewer/prcls_fullAdd_parsed_FINAL/FeatureServer/0'
new_wayne = 'https://services2.arcgis.com/qvkbeam7WirpsIPC/arcgis/rest/services/City_of_Detroit_Parcels/FeatureServer/0'
if old_wayne in content:
    content = content.replace(old_wayne, new_wayne, 1)
    print("Replaced Wayne County / Detroit parcel endpoint successfully")
else:
    print("WARNING: old_wayne not found")

# 3. St. Charles County, MO (29183)
old_scc = 'https://maps.sccmo.org/scc_gis/rest/services/open_data/Tax_Information/FeatureServer/3'
new_scc = 'https://services7.arcgis.com/n2n27A5sWjEWTpfF/arcgis/rest/services/St_Charles_County_Parcels/FeatureServer/0'
if old_scc in content:
    content = content.replace(old_scc, new_scc, 1)
    print("Replaced St. Charles County parcel endpoint successfully")
else:
    print("WARNING: old_scc not found")

# 4. Lincoln County, SD (46083)
old_lincoln = 'https://gis.lincolncountysd.gov/arcgis/rest/services/ParcelRelate/MapServer/0'
new_lincoln = 'https://gis.siouxfalls.gov/arcgis/rest/services/Data/Property/MapServer/1'
if old_lincoln in content:
    content = content.replace(old_lincoln, new_lincoln, 1)
    print("Replaced Lincoln County SD parcel endpoint successfully")
else:
    print("WARNING: old_lincoln not found")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.html size:", len(content))
