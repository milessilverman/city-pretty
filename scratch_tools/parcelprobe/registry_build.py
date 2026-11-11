"""build w5/round87/parcels87.json: one entry per verified parcel service, fields allow-listed (never owner or mailing fields), filtered to
the fields each layer really has, with the layer's own aliases, tested with a live query (shapes returned)"""
import json, subprocess, urllib.parse, sys
R = {s["state_or_scope"]: s for s in json.load(open("/home/user/w5/round87/parcels_research.json"))["sources"]}
P = {r["scope"]: r for r in json.load(open("/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/parcelprobe/probe.json"))}
def find(prefix, d): return next((v for k, v in d.items() if k.startswith(prefix)), None)
UT = "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0"
NYC = ["36005", "36047", "36061", "36081", "36085"]
E = [  # (research scope prefix, state FIPS or county FIPS list, allowed fields)
 ("North Carolina", "37", "parno siteadd scity parusedesc parusecode landval improvval parval parvaltype saledate gisacres cntyname"),
 ("Florida", "12", "PARCEL_ID PHY_ADDR1 PHY_CITY DOR_UC JV LND_VAL AV_SD TV_SD ASMNT_YR SALE_PRC1 SALE_YR1 SALE_MO1 ACT_YR_BLT LND_SQFOOT NO_RES_UNT"),
 ("Wisconsin", "55", "PARCELID SITEADRESS PLACENAME PROPCLASS CNTASSDVALUE LNDVALUE IMPVALUE ESTFMKVALUE TAXROLLYEAR GISACRES CONAME"),
 ("Massachusetts", "25", "PROP_ID SITE_ADDR CITY USE_CODE USE_DESC LAND_VAL BLDG_VAL TOTAL_VAL FY LS_DATE LS_PRICE LOT_SIZE YEAR_BUILT UNITS"),
 ("Utah", "49", "PARCEL_ID PARCEL_ADD PARCEL_CITY PARCEL_ZIP County CoParcel_URL"),
 ("Montana", "30", "PARCELID AddressLine1 CityStateZip PropType TotalLandValue TotalBuildingValue TotalValue TaxYear GISAcres CountyName"),
 ("Washington", "53", "PARCEL_ID_NR SITUS_ADDRESS SITUS_CITY_NM LANDUSE_CD VALUE_LAND VALUE_BLDG DATA_LINK"),
 ("New Jersey", "34", "PAMS_PIN PROP_LOC MUN_NAME PROP_CLASS PROP_USE LAND_VAL IMPRVT_VAL NET_VALUE LAST_YR_TX SALE_PRICE DEED_DATE YR_CONSTR CALC_ACRE"),
 ("Connecticut", "09", "Parcel_ID Location_1 Property_City State_Use_Description Assessed_Total Assessed_Land Assessed_Building Appraised_Land Appraised_Building Valuation_Year Sale_Price Sale_Date Land_Acres Zone AYB"),
 ("Maryland", "24", "ACCTID PREMSNUM PREMSNAM PREMSTYP PREMCITY DESCLU ZONING ACRES NFMLNDVL NFMIMPVL NFMTTLVL YEARBLT"),
 ("Vermont", "50", "SPAN E911ADDR TNAME DESCPROP CAT REAL_FLV LAND_LV IMPRV_LV YEAR ACRESGL"),
 ("New York (38", "36", "PRINT_KEY PARCEL_ADDR CITYTOWN_NAME MUNI_NAME PROP_CLASS USED_AS_DESC LAND_AV TOTAL_AV FULL_MARKET_VAL YR_BLT ACRES COUNTY_NAME"),
 ("Colorado", "08", "parcel_id situsAdd sitAddCty landUseDsc zoningDesc apprValTot asedValTot saleDate salePrice landAcres URL countyName"),
 ("Indiana", "18", "parcel_id prop_add prop_city dlgf_prop_class_code"),
 ("Minnesota", "27", "county_pin anumber st_name st_pos_typ ctu_name useclass1 emv_land emv_bldg emv_total tax_year mkt_year acres_poly co_name"),
 ("Virginia", "51", "PARCELID LOCALITY PTM_ID"),
 ("West Virginia", "54", "CleanParcelID FullPhysicalAddress FullLegalDescription CALC_ACRE"),
 ("Delaware", "10", "PIN ACRES COUNTY"),
 ("Arkansas", "05", "parcelid adrlabel adrcity parceltype landvalue impvalue totalvalue assessvalue county camadate"),
 ("District of Columbia", "11", "SSL PREMISEADD USECODE PROPTYPE NEWLAND NEWIMPR NEWTOTAL LANDAREA NBHDNAME"),
 ("Maine", "23", "MAP_BK_LOT PROP_LOC TOWN COUNTY TYPE"),
 ("Ohio", "39", "LocalParcelID SitusAddressAll StateLUC County CAMADataSite"),
 ("North Dakota", "38", "GISID CountyName SubdivisionPlat Lot Block CalculatedAcres"),
 ("Wyoming", "56", "parcelnb locationad jurisdicti actualvalu assessedva taxyear landgrossa"),
 ("Idaho", "16", "PARCEL_ID SITE_ADD SITE_CITY ASR_CATS VAL_LAND VAL_IMPVTS VAL_TOTAL ASR_ACRES County WEBSITE"),
 ("Nebraska", "31", "Parcel_ID Situs_Address Ph_City Classification_Code Property_SubClass Total_Assessed_Value Land_Value Improvements_Value Sales_Date Sales_Value GIS_Acres BuildingYear Parcel_URL"),
 ("Rhode Island", "44", "PlatLot TownCode E911Desc Acres"),
 ("New York City", NYC, "Borough Block Lot Address LandUse BldgClass ZoneDist1 LotArea BldgArea UnitsRes NumFloors AssessLand AssessTot YearBuilt"),
 ("Maricopa", ["04013"], "APN_DASH PHYSICAL_ADDRESS PHYSICAL_CITY PUC FCV_CUR LPV_CUR TAX_YR_CUR SALE_DATE SALE_PRICE LAND_SIZE CONST_YEAR CITY_ZONING"),
 ("Cook", ["17031"], "PIN14 Address City BLDGClass LandValue BldgValue TotalValue TAXYR BldgAge LandSqft"),
 ("San Diego", ["06073"], "apn situs_address situs_community asr_landuse asr_land asr_impr asr_total acreage total_lvg_area year_effective"),
 ("Franklin County, OH", ["39049"], "PARCELID SITEADDRESS CLASSDSCRP ACRES SALEDATE SALEPRICE RESYRBLT APPRLAND APPRBLDG APPRTOT"),
 ("Fulton", ["13121"], "ParcelID Address LUCode ClassCode LivUnits LandAcres TaxYear"),
 ("Allegheny", ["42003"], "PIN MAPBLOCKLOT CALCACREAGE"),
 ("Clark County, NV", ["32003"], "APN ASSR_ACRES PARCELTYPE"),
]
def curl(url):
    r = subprocess.run(["curl", "-sS", "-m", "45", "-A", "Mozilla/5.0 (compatible; city-pretty/1.0)", url], capture_output=True, text=True)
    return json.loads(r.stdout)
out = []
for scope, where, fields in E:
    rs, pr = find(scope, R), find(scope, P)
    url = UT if scope == "Utah" else (pr or {}).get("url") or (rs or {}).get("url")
    meta = curl(url + "?f=json")
    have = {f["name"]: f.get("alias") or f["name"] for f in meta.get("fields", [])}
    keep = [f for f in fields.split() if f in have]
    drop = [f for f in fields.split() if f not in have]
    tp = (pr or {}).get("point")
    test = None
    if tp:
        q = {"geometry": f"{tp[0]-0.0002},{tp[1]-0.0002},{tp[0]+0.0002},{tp[1]+0.0002}", "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
             "outFields": ",".join(keep), "returnGeometry": "true", "outSR": "4326", "geometryPrecision": "6", "f": "json"}
        d = curl(url + "/query?" + urllib.parse.urlencode(q))
        fs = d.get("features") or []
        test = {"n": len(fs), "rings": bool(fs and (fs[0].get("geometry") or {}).get("rings")), "error": d.get("error")}
    e = {"scope": scope, "states" if isinstance(where, str) else "counties": [where] if isinstance(where, str) else where, "url": url,
         "name": (rs or {}).get("name", scope), "terms": (rs or {}).get("terms_url", ""), "fields": [[f, have[f]] for f in keep],
         "max": meta.get("maxRecordCount"), "test": test}
    out.append(e)
    print(f"{scope[:22]:22s} keep {len(keep):2d} drop {drop} test {test}")
json.dump(out, open("/home/user/w5/round87/parcels87.json", "w"), indent=1)
print("entries:", len(out))
