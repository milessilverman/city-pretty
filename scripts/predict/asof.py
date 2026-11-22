"""As-of guard (docs/PREDICTION-MODEL.md A.3): a feature for origin T may only read data published by 31 Dec of T.

Every feature reads its inputs through Guard.get(source, data_year). A read of a year published after T raises
AsOfViolation. The publication lags are the pre-registered rules; change them only with a dated note in the doc.
"""

# data year t of a source is published in year t + lag; usable at origin T iff t + lag <= T
PUB_LAG = {
    "fhfa": 1,         # FHFA annual tract index, year t published spring t+1
    "fhfa_county": 1,  # FHFA annual county index
    "hmda": 1,         # HMDA public file for year t
    "bps_place": 1,    # Building Permits Survey annual place file
    "bps_county": 1,   # Building Permits Survey annual county file
    "lodes": 2,        # LODES8 workplace jobs, about 21-23 months after year end
    "lodes5km": 2,     # derived from LODES (sum over tracts within 5 km)
    "irs": 2,          # IRS county migration, keyed by year_end (pair 2324 -> 2024, posted Nov 2026)
    "acs": 1,          # ACS 5-year keyed by its end year E, released December E+1
    "zillow": 0,       # internal only: keyed by year, value is the November figure, published mid-December
}


class AsOfViolation(Exception):
    pass


def usable(source, data_year, T):
    return data_year + PUB_LAG[source] <= T


class Guard:
    """Read-only view of a store for origin T. store: {source: {data_year: {key: value}}}."""

    def __init__(self, store, T):
        self.store, self.T, self.reads = store, T, []

    def get(self, source, year):
        if not usable(source, year, self.T):
            raise AsOfViolation(f"origin {self.T}: {source} {year} is published in {year + PUB_LAG[source]}")
        self.reads.append((source, year))
        return self.store.get(source, {}).get(year, {})

    def latest(self, source):
        """Latest data year of `source` that is usable at T (None if none). Reads nothing."""
        ys = [y for y in self.store.get(source, {}) if usable(source, y, self.T)]
        return max(ys) if ys else None
