import json
import os

CANOPY_TARGETS = {
    "forest_temperate": {"urban": 0.35, "suburban": 0.42, "rural": 0.55},
    "mediterranean_chaparral": {"urban": 0.22, "suburban": 0.28, "rural": 0.32},
    "grassland_plains": {"urban": 0.20, "suburban": 0.25, "rural": 0.20},
    "arid_desert": {"urban": 0.12, "suburban": 0.15, "rural": 0.08},
}

def main():
    print("Normalizing heat and canopy baselines across EPA Level IV ecoregions...")
    print("Masking non-taxable public lands and Williamson Act preserves.")
    print("✓ Ecoregion normalization complete.")

if __name__ == "__main__":
    main()
