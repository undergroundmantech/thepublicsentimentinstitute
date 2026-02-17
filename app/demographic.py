from pathlib import Path

updated_code = r'''
# streamlit_app.py
# Demographic Turnout Simulator (State-level) — Turnout numbers only
#
# Run:
#   pip install streamlit pandas numpy plotly
#   streamlit run streamlit_app.py
#
# Update (per request):
# - Adds **education splits** to create 4 groups:
#   1) White college
#   2) White non-college
#   3) Non-white college
#   4) Non-white non-college
#
# Notes:
# - Baseline is 2024 state votes (R/D/Third) = turnout numbers only.
# - Group shares are approximated using:
#   - White share (DP05, else fallback)
#   - College share (S1501, else fallback)
#   - Assumes college share applies similarly across race (simple approximation).
# - Each group has:
#   - turnout meter (0→1 adds votes with caps + iterative allocator)
#   - party-share sliders (R swing + Third swing; D implied and normalized)

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

st.set_page_config(page_title="Demographic Turnout Simulator", layout="wide")

# ----------------------------
# 0) Baseline: 2024 votes by state (R/D/Third) — 50 states + DC
# ----------------------------
BASE_2024 = [
    ("Alabama",        1462616,   772412,   30062),
    ("Alaska",          184458,   140026,   13693),
    ("Arizona",        1770242,  1582860,   37059),
    ("Arkansas",        759241,   396905,   26530),
    ("California",     6081697,  9276179,  507599),
    ("Colorado",       1377441,  1728159,   87145),
    ("Connecticut",     736918,   992053,   30039),
    ("Delaware",        214351,   289758,    8803),
    ("District of Columbia", 21076, 294185, 10608),
    ("Florida",        6110125,  4683038,  100589),
    ("Georgia",        2663117,  2548017,   39771),
    ("Hawaii",          193661,   313044,    9996),
    ("Idaho",           605246,   274972,   24839),
    ("Illinois",       2449079,  3062863,  121368),
    ("Indiana",        1720347,  1163603,   52727),
    ("Iowa",            927019,   707278,   29209),
    ("Kansas",          758802,   544853,   23936),
    ("Kentucky",       1337494,   704043,   32993),
    ("Louisiana",      1208505,   766870,   31600),
    ("Maine",           377977,   435652,   17746),
    ("Maryland",       1035550,  1902577,  100207),
    ("Massachusetts",  1251303,  2126518,   95847),
    ("Michigan",       2816636,  2736533,  111017),
    ("Minnesota",      1519032,  1656979,   77909),
    ("Mississippi",     747744,   466668,   13596),
    ("Missouri",       1751986,  1200599,   42742),
    ("Montana",         352079,   231906,   19005),
    ("Nebraska",        564816,   369995,   17371),
    ("Nevada",          751205,   705197,   28438),
    ("New Hampshire",   395523,   418488,   12178),
    ("New Jersey",     1968215,  2220713,   83797),
    ("New Mexico",      423391,   478802,   21210),
    ("New York",       3578899,  4619195,   64401),
    ("North Carolina", 2898423,  2715375,   85343),
    ("North Dakota",    246505,   112327,    9323),
    ("Ohio",           3180116,  2533699,   53973),
    ("Oklahoma",       1036213,   499599,   30361),
    ("Oregon",          919480,  1240600,   84413),
    ("Pennsylvania",   3543308,  3423042,   92382),
    ("Rhode Island",    214406,   285156,   13824),
    ("South Carolina", 1483747,  1028452,   35941),
    ("South Dakota",    272081,   146859,    9982),
    ("Tennessee",      1966865,  1056265,   40812),
    ("Texas",          6393597,  4835250,  159827),
    ("Utah",            883818,   562566,   42110),
    ("Vermont",         119395,   235791,   14236),
    ("Virginia",       2075085,  2335395,   95461),
    ("Washington",     1530923,  2245849,  147471),
    ("West Virginia",   533556,   214309,   14717),
    ("Wisconsin",      1697626,  1668229,   57063),
    ("Wyoming",         192633,    69527,    6888),
]

STATE_ABBR = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
    "Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI",
    "Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
    "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
    "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
    "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
    "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN",
    "Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
}

def normalize_three(r, d, t):
    r = max(r, 0.0); d = max(d, 0.0); t = max(t, 0.0)
    s = r + d + t
    if s <= 1e-12:
        return 0.0, 1.0, 0.0
    return r/s, d/s, t/s

# ----------------------------
# 1) Load ACS (race + education)
# ----------------------------
@st.cache_data(show_spinner=False)
def load_acs(dp05_path: str, s1501_path: str):
    """
    Returns:
      white_share_by_state: dict[state] -> white_non_hisp_share (0..1)
      college_share_by_state: dict[state] -> bachelors+ share (0..1)
      flags dp05_ok, s1501_ok
    """
    white_share = {}
    college = {}
    dp05_ok = False
    s1501_ok = False

    # --- DP05 (race/ethnicity): we only need White non-Hisp share.
    try:
        dp05 = pd.read_csv(dp05_path, dtype=str)
        dp05["NAME"] = dp05["NAME"].astype(str)
        dp05_state = dp05[dp05["NAME"].isin(list(STATE_ABBR.keys()) + ["District of Columbia"])].copy()

        for c in dp05_state.columns:
            if c in ("GEO_ID","NAME"):
                continue
            dp05_state[c] = pd.to_numeric(dp05_state[c].str.replace(",","", regex=False), errors="coerce")

        cols_lower = {c: c.lower() for c in dp05_state.columns}

        def find_col(keywords_any, keywords_all=()):
            candidates = []
            for c, lc in cols_lower.items():
                if c in ("GEO_ID","NAME"):
                    continue
                if any(k in lc for k in keywords_any) and all(k in lc for k in keywords_all):
                    candidates.append(c)
            return candidates[0] if candidates else None

        total_col = find_col(["total population", "total"])
        white_nh_col = find_col(
            ["white alone, not hispanic", "white alone not hispanic", "not hispanic or latino"],
            keywords_all=("white",)
        )
        white_alone_col = find_col(["white alone"])
        hisp_col = find_col(["hispanic", "latino"])

        if total_col and (white_nh_col or white_alone_col):
            dp05_ok = True
            for _, row in dp05_state.iterrows():
                name = row["NAME"]
                total = row[total_col]
                if pd.isna(total) or total <= 0:
                    continue
                if white_nh_col and pd.notna(row[white_nh_col]):
                    wn = float(row[white_nh_col])
                else:
                    # fallback: approximate non-hisp white with white alone (no subtraction applied)
                    wn = float(row[white_alone_col]) if (white_alone_col and pd.notna(row[white_alone_col])) else np.nan
                if np.isfinite(wn) and wn >= 0:
                    white_share[name] = float(np.clip(wn/total, 0.0, 1.0))
    except Exception:
        dp05_ok = False

    # --- S1501 (education): bachelors+ percent among 25+
    try:
        edu = pd.read_csv(s1501_path, dtype=str)
        edu["NAME"] = edu["NAME"].astype(str)
        edu_state = edu[edu["NAME"].isin(list(STATE_ABBR.keys()) + ["District of Columbia"])].copy()

        for c in edu_state.columns:
            if c in ("GEO_ID","NAME"):
                continue
            edu_state[c] = pd.to_numeric(edu_state[c].str.replace(",","", regex=False), errors="coerce")

        cols_lower = {c: c.lower() for c in edu_state.columns}
        bachp_cols = [c for c, lc in cols_lower.items() if "bachelor" in lc and ("percent" in lc or "pct" in lc) and "higher" in lc]
        bach_only_cols = [c for c, lc in cols_lower.items() if "bachelor" in lc and ("percent" in lc or "pct" in lc) and "higher" not in lc]
        grad_cols = [c for c, lc in cols_lower.items() if ("graduate" in lc or "professional" in lc) and ("percent" in lc or "pct" in lc)]

        if bachp_cols:
            col = bachp_cols[0]
            for _, row in edu_state.iterrows():
                name = row["NAME"]
                val = row[col]
                if pd.notna(val):
                    college[name] = float(val)/100.0 if val > 1 else float(val)
            s1501_ok = True
        elif bach_only_cols and grad_cols:
            bcol = bach_only_cols[0]
            gcol = grad_cols[0]
            for _, row in edu_state.iterrows():
                name = row["NAME"]
                b = row[bcol] if pd.notna(row[bcol]) else 0.0
                g = row[gcol] if pd.notna(row[gcol]) else 0.0
                val = b + g
                college[name] = float(val)/100.0 if val > 1 else float(val)
            s1501_ok = True
    except Exception:
        s1501_ok = False

    return white_share, college, dp05_ok, s1501_ok


# ----------------------------
# 2) Capped allocator for extra votes (iterative reallocation)
# ----------------------------
def allocate_with_caps(target_extra_votes: float, presence: np.ndarray, cap: np.ndarray):
    alloc = np.zeros(len(presence), dtype=float)
    remaining = float(max(target_extra_votes, 0.0))
    active = cap > 1e-9
    if remaining <= 1e-9 or not np.any(active):
        return alloc

    for _ in range(200):
        if remaining <= 1e-6:
            break
        idx = np.where(active)[0]
        if len(idx) == 0:
            break
        w = np.clip(presence[idx].copy(), 0, None)
        if w.sum() <= 1e-12:
            w[:] = 1.0
        shares = w / w.sum()
        proposed = shares * remaining
        room = cap[idx] - alloc[idx]
        take = np.minimum(proposed, room)
        alloc[idx] += take
        remaining -= float(take.sum())
        active = (cap - alloc) > 1e-6

    return alloc


def turnout_meter_apply(df: pd.DataFrame, group: str, meter: float, cap_factor: float):
    """
    Adds votes to df[f'{group}_turnout_base'] producing df[f'{group}_turnout'].
    cap = cap_factor * baseline_group_turnout_in_state
    target_extra = meter * nat_cap_total  (meter=1 -> max out national cap)
    presence = baseline group turnout share (so states with more of the group rise first)
    """
    base_turn = df[f"{group}_turnout_base"].to_numpy(dtype=float)
    cap = cap_factor * base_turn
    target = float(meter) * float(cap.sum())

    presence = base_turn.copy()
    presence = presence / presence.sum() if presence.sum() > 0 else np.ones_like(presence) / len(presence)

    extra = allocate_with_caps(target, presence, cap)
    df[f"{group}_turnout"] = base_turn + extra
    df[f"{group}_extra"] = extra
    return df


# ----------------------------
# 3) UI
# ----------------------------
st.title("Demographic Turnout Simulator (Votes-Only) — Race × Education (States + DC)")

with st.expander("What this simulator does", expanded=False):
    st.markdown(
        """
- **Baseline turnout** is the **2024 total votes cast** in each state (R + D + Third).
- We estimate each state’s **White share** (DP05) and **College share** (S1501), then create 4 groups:
  - **White college**, **White non-college**, **Non-white college**, **Non-white non-college**
- Each group has a **turnout meter** (0 → 1) that adds votes nationally and allocates them across states with:
  - **Presence weighting** (states with more of the group rise first)
  - **Caps** (prevents unrealistic maxing)
- Each group has **party-share sliders** (R swing and Third swing). **D is implied** and renormalized.
- The map colors states **Red/Blue** by winner; intensity scales with margin.
        """
    )

DP05_PATH_DEFAULT = "/mnt/data/ACSDP1Y2024.DP05-2026-02-10T142347.csv"
S1501_PATH_DEFAULT = "/mnt/data/ACSST1Y2024.S1501-2026-02-10T142905.csv"

with st.sidebar:
    st.header("Data")
    dp05_path = st.text_input("ACS DP05 path (race/ethnicity)", DP05_PATH_DEFAULT)
    s1501_path = st.text_input("ACS S1501 path (education)", S1501_PATH_DEFAULT)

    st.header("Turnout caps")
    cap_factor = st.slider(
        "Max extra turnout as fraction of baseline group turnout (cap factor)",
        0.05, 0.40, 0.20, 0.01,
        help="Example: 0.20 means a group can add up to +20% of its baseline turnout in a state."
    )

    st.header("Turnout meters (0→1 adds votes)")
    m_wc  = st.slider("White college turnout meter", 0.0, 1.0, 0.0, 0.01)
    m_wnc = st.slider("White non-college turnout meter", 0.0, 1.0, 0.0, 0.01)
    m_nwc = st.slider("Non-white college turnout meter", 0.0, 1.0, 0.0, 0.01)
    m_nwnc= st.slider("Non-white non-college turnout meter", 0.0, 1.0, 0.0, 0.01)

    st.header("Vote share sliders (by group)")
    st.caption("R swing and Third swing are in **percentage points**; D is implied and normalized.")

    # Base prefs from your 2024 cross-tabs (Education×Race 2×2)
    # White non college: 34 D / 65 R / 1 T
    # White college:     53 D / 45 R / 2 T
    # Non-white non college: 65 D / 33 R / 1 T
    # Non-white college:     69 D / 29 R / 2 T
    r_wc_swing   = st.slider("White college R swing (pp)", -15.0, 15.0, 0.0, 0.5)
    t_wc_swing   = st.slider("White college Third swing (pp)", -5.0, 5.0, 0.0, 0.5)

    r_wnc_swing  = st.slider("White non-college R swing (pp)", -15.0, 15.0, 0.0, 0.5)
    t_wnc_swing  = st.slider("White non-college Third swing (pp)", -5.0, 5.0, 0.0, 0.5)

    r_nwc_swing  = st.slider("Non-white college R swing (pp)", -15.0, 15.0, 0.0, 0.5)
    t_nwc_swing  = st.slider("Non-white college Third swing (pp)", -5.0, 5.0, 0.0, 0.5)

    r_nwnc_swing = st.slider("Non-white non-college R swing (pp)", -15.0, 15.0, 0.0, 0.5)
    t_nwnc_swing = st.slider("Non-white non-college Third swing (pp)", -5.0, 5.0, 0.0, 0.5)

# Load baseline
base = pd.DataFrame(BASE_2024, columns=["state","R_base","D_base","T_base"])
base["abbr"] = base["state"].map(STATE_ABBR)
base["total_base"] = base["R_base"] + base["D_base"] + base["T_base"]

# Load ACS
white_share, college_share, dp05_ok, edu_ok = load_acs(dp05_path, s1501_path)

# Attach shares (fallbacks)
WHITE_FALLBACK = 0.75
COLLEGE_FALLBACK = 0.34

base["white_sh"] = base["state"].apply(lambda s: float(white_share.get(s, WHITE_FALLBACK)))
base["college_sh"] = base["state"].apply(lambda s: float(college_share.get(s, COLLEGE_FALLBACK)))

st.caption(
    f"ACS detection: DP05 white share={'✅' if dp05_ok else '⚠️ fallback'}, "
    f"S1501 college share={'✅' if edu_ok else '⚠️ fallback'}"
)

# ----------------------------
# 4) Create 4 group shares per state
# ----------------------------
# Group shares sum to 1 by construction.
base["wc_sh"]   = base["white_sh"] * base["college_sh"]
base["wnc_sh"]  = base["white_sh"] * (1.0 - base["college_sh"])
base["nwc_sh"]  = (1.0 - base["white_sh"]) * base["college_sh"]
base["nwnc_sh"] = (1.0 - base["white_sh"]) * (1.0 - base["college_sh"])

# Baseline group turnout (votes)
base["wc_turnout_base"]   = base["total_base"] * base["wc_sh"]
base["wnc_turnout_base"]  = base["total_base"] * base["wnc_sh"]
base["nwc_turnout_base"]  = base["total_base"] * base["nwc_sh"]
base["nwnc_turnout_base"] = base["total_base"] * base["nwnc_sh"]

# ----------------------------
# 5) Apply turnout meters per group
# ----------------------------
sim = base.copy()
sim = turnout_meter_apply(sim, "wc",   m_wc,   cap_factor)
sim = turnout_meter_apply(sim, "wnc",  m_wnc,  cap_factor)
sim = turnout_meter_apply(sim, "nwc",  m_nwc,  cap_factor)
sim = turnout_meter_apply(sim, "nwnc", m_nwnc, cap_factor)

sim["total_sim_turnout"] = sim[["wc_turnout","wnc_turnout","nwc_turnout","nwnc_turnout"]].sum(axis=1)

# ----------------------------
# 6) Party preferences per group + sliders
# ----------------------------
prefs = {
    "wc":   {"D":0.53, "R":0.45, "T":0.02, "r_swing":r_wc_swing,   "t_swing":t_wc_swing},
    "wnc":  {"D":0.34, "R":0.65, "T":0.01, "r_swing":r_wnc_swing,  "t_swing":t_wnc_swing},
    "nwc":  {"D":0.69, "R":0.29, "T":0.02, "r_swing":r_nwc_swing,  "t_swing":t_nwc_swing},
    "nwnc": {"D":0.65, "R":0.33, "T":0.01, "r_swing":r_nwnc_swing, "t_swing":t_nwnc_swing},
}

def party_shares_for_group(group: str):
    p = prefs[group]
    R = p["R"] + p["r_swing"]/100.0
    T = p["T"] + p["t_swing"]/100.0
    D = p["D"]
    return normalize_three(R, D, T)

for g in ["wc","wnc","nwc","nwnc"]:
    r, d, t = party_shares_for_group(g)
    sim[f"{g}_Rsh"] = r
    sim[f"{g}_Dsh"] = d
    sim[f"{g}_Tsh"] = t

    sim[f"{g}_R"] = sim[f"{g}_turnout"] * sim[f"{g}_Rsh"]
    sim[f"{g}_D"] = sim[f"{g}_turnout"] * sim[f"{g}_Dsh"]
    sim[f"{g}_T"] = sim[f"{g}_turnout"] * sim[f"{g}_Tsh"]

sim["R_sim"] = sim[[f"{g}_R" for g in ["wc","wnc","nwc","nwnc"]]].sum(axis=1)
sim["D_sim"] = sim[[f"{g}_D" for g in ["wc","wnc","nwc","nwnc"]]].sum(axis=1)
sim["T_sim"] = sim[[f"{g}_T" for g in ["wc","wnc","nwc","nwnc"]]].sum(axis=1)

sim["margin_R_minus_D"] = sim["R_sim"] - sim["D_sim"]
sim["winner"] = np.where(sim["margin_R_minus_D"] >= 0, "R", "D")

# ----------------------------
# 7) Map + outputs
# ----------------------------
colA, colB = st.columns([1.2, 1.0], gap="large")

with colA:
    st.subheader("Map (winner by state)")
    plot_df = sim.copy()
    plot_df["margin_pct"] = 100.0 * plot_df["margin_R_minus_D"] / plot_df["total_sim_turnout"]

    fig = px.choropleth(
        plot_df,
        locations="abbr",
        locationmode="USA-states",
        color="margin_pct",
        scope="usa",
        hover_name="state",
        hover_data={
            "abbr": False,
            "margin_pct":":.2f",
            "R_sim":":,.0f",
            "D_sim":":,.0f",
            "T_sim":":,.0f",
            "total_sim_turnout":":,.0f"
        },
        color_continuous_scale=["#08306B", "#F7FBFF", "#67000D"],  # blue -> white -> red
        range_color=[-20, 20],
    )
    fig.update_layout(margin=dict(l=0,r=0,t=0,b=0), coloraxis_colorbar=dict(title="R−D (pp)"))
    st.plotly_chart(fig, use_container_width=True)

with colB:
    st.subheader("National totals")
    nat_R = float(sim["R_sim"].sum())
    nat_D = float(sim["D_sim"].sum())
    nat_T = float(sim["T_sim"].sum())
    nat_total = nat_R + nat_D + nat_T

    st.metric("Total votes (simulated)", f"{nat_total:,.0f}")
    st.metric("R votes", f"{nat_R:,.0f}", delta=f"{(nat_R - base['R_base'].sum()):+,.0f} vs 2024 baseline")
    st.metric("D votes", f"{nat_D:,.0f}", delta=f"{(nat_D - base['D_base'].sum()):+,.0f} vs 2024 baseline")
    st.metric("Third votes", f"{nat_T:,.0f}", delta=f"{(nat_T - base['T_base'].sum()):+,.0f} vs 2024 baseline")

    st.subheader("Top turnout changes")
    out = sim[["state","R_sim","D_sim","T_sim","total_sim_turnout","margin_R_minus_D"]].copy()
    out["baseline_total"] = base["total_base"].values
    out["turnout_change"] = out["total_sim_turnout"] - out["baseline_total"]
    out = out.sort_values("turnout_change", ascending=False).head(12)
    st.dataframe(out.style.format({
        "R_sim":"{:,.0f}","D_sim":"{:,.0f}","T_sim":"{:,.0f}",
        "total_sim_turnout":"{:,.0f}","baseline_total":"{:,.0f}",
        "turnout_change":"{:+,.0f}","margin_R_minus_D":"{:+,.0f}"
    }), use_container_width=True, height=420)

st.subheader("State table (downloadable)")
table = sim[[
    "state","abbr","R_sim","D_sim","T_sim","total_sim_turnout","margin_R_minus_D",
    "wc_turnout","wnc_turnout","nwc_turnout","nwnc_turnout",
    "wc_extra","wnc_extra","nwc_extra","nwnc_extra",
    "white_sh","college_sh","wc_sh","wnc_sh","nwc_sh","nwnc_sh"
]].copy()

st.download_button(
    "Download simulated state results (CSV)",
    data=table.to_csv(index=False).encode("utf-8"),
    file_name="simulated_state_results.csv",
    mime="text/csv"
)

st.dataframe(
    table.sort_values("margin_R_minus_D", ascending=False).style.format({
        "R_sim":"{:,.0f}","D_sim":"{:,.0f}","T_sim":"{:,.0f}",
        "total_sim_turnout":"{:,.0f}","margin_R_minus_D":"{:+,.0f}",
        "wc_turnout":"{:,.0f}","wnc_turnout":"{:,.0f}","nwc_turnout":"{:,.0f}","nwnc_turnout":"{:,.0f}",
        "wc_extra":"{:,.0f}","wnc_extra":"{:,.0f}","nwc_extra":"{:,.0f}","nwnc_extra":"{:,.0f}",
        "white_sh":"{:.3f}","college_sh":"{:.3f}","wc_sh":"{:.3f}","wnc_sh":"{:.3f}","nwc_sh":"{:.3f}","nwnc_sh":"{:.3f}",
    }),
    use_container_width=True,
    height=560
)
'''

out_path = Path("/mnt/data/streamlit_app.py")
out_path.write_text(updated_code)
str(out_path)