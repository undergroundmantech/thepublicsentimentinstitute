"""Map every campaign stop city in public/watchdog/trail.json to its county FIPS.
Usage: python3 -I build_stop_counties.py /path/to/site
Writes public/watchdog/stop_counties.json as {"ST|City": ["fips", ...]}."""
import json, sys, os
site = sys.argv[1]
CITY = {
 "AK": {"Fairbanks": ["Fairbanks North Star"], "Wasilla": ["Matanuska-Susitna"]},
 "AL": {"Mobile": ["Mobile"]}, "AR": {"North Little Rock": ["Pulaski"]},
 "AZ": {"Bullhead City": ["Mohave"], "Casa Grande": ["Pinal"]},
 "CA": {"Escondido": ["San Diego"], "Rancho Palos Verdes": ["Los Angeles"], "Stockton": ["San Joaquin"]},
 "FL": {"Fort Myers": ["Lee"], "Gainesville": ["Alachua"], "Hollywood": ["Broward"], "Lakeland": ["Polk"], "Orlando": ["Orange"], "Tallahassee": ["Leon"], "Tampa": ["Hillsborough"]},
 "GA": {"Atlanta": ["Fulton"], "Dalton": ["Whitfield"], "Macon": ["Bibb"]},
 "IA": {"Clear Lake": ["Cerro Gordo"], "Clive": ["Polk"], "Council Bluffs": ["Pottawattamie"], "Des Moines": ["Polk"], "Newton": ["Jasper"], "Sioux City": ["Woodbury"]},
 "KS": {"Olathe": ["Johnson"], "Park City": ["Sedgwick"]},
 "KY": {"Frankfort": ["Franklin"], "Highland Heights": ["Campbell"]},
 "ME": {"Bangor": ["Penobscot"], "Portland": ["Cumberland"]},
 "MI": {"Detroit": ["Wayne"], "Escanaba, Iron Mountain, Marquette": ["Delta", "Dickinson", "Marquette"], "Kalamazoo": ["Kalamazoo"], "Monroe": ["Monroe"], "Port Huron": ["St. Clair"], "Rochester": ["Oakland"], "Sterling Heights": ["Macomb"], "Warren": ["Macomb"], "West Bloomfield": ["Oakland"]},
 "MS": {"Gulf Coast": ["Harrison"], "Gulfport": ["Harrison"], "Jackson": ["Hinds"]},
 "MT": {"Bozeman": ["Gallatin"], "Kalispell": ["Flathead"]},
 "NC": {"Gastonia": ["Gaston"], "Greensboro": ["Guilford"], "Greenville": ["Pitt"], "Hendersonville": ["Henderson"], "Monroe": ["Union"]},
 "NE": {"Grand Island": ["Hall"], "North Platte": ["Lincoln"]},
 "NH": {"Concord": ["Merrimack"], "Exeter": ["Rockingham"], "Rochester": ["Strafford"]},
 "NJ": {"Warren County": ["Warren"]}, "NM": {"Las Cruces": ["Doña Ana"]},
 "NV": {"Henderson": ["Clark"], "Las Vegas": ["Clark"], "North Las Vegas": ["Clark"], "Reno": ["Washoe"]},
 "NY": {"Bethpage": ["Nassau"], "Buffalo": ["Erie"], "Garden City": ["Nassau"], "Southampton": ["Suffolk"], "Syracuse": ["Onondaga"], "Tarrytown": ["Westchester"], "Westchester County": ["Westchester"]},
 "OH": {"Cleveland": ["Cuyahoga"], "Lima": ["Allen"], "Middletown": ["Butler"], "Sharonville": ["Hamilton"], "Toledo": ["Lucas"], "Vandalia": ["Montgomery"], "Youngstown": ["Mahoning"]},
 "OK": {"Durant": ["Bryan"]}, "PA": {"Allentown": ["Lehigh"], "Bethlehem": ["Northampton"]},
 "SC": {"Aiken": ["Aiken"], "Charleston": ["Charleston"], "Charleston, Manning, Columbia": ["Charleston", "Clarendon", "Richland"], "Hardeeville": ["Jasper"], "Myrtle Beach": ["Horry"], "Pendleton": ["Anderson"]},
 "TN": {"Clarksville": ["Montgomery"]},
 "TX": {"Corpus Christi": ["Nueces"], "Dallas": ["Dallas"], "Denton": ["Denton"], "El Paso": ["El Paso"], "Harlingen": ["Cameron"], "Houston": ["Harris"], "Lubbock": ["Lubbock"], "San Antonio": ["Bexar"], "San Patricio County": ["San Patricio"], "Tyler": ["Smith"], "Waco": ["McLennan"]},
 "VA": {"Henrico": ["Henrico"]}, "WA": {"Chehalis": ["Lewis"], "Olympia": ["Thurston"]},
 "WI": {"Racine": ["Racine"], "Sparta": ["Monroe"]},
}
co = json.load(open(os.path.join(site, "public/watchdog/counties.json")))
by = {}
for f, v in co.items():
    by.setdefault((v["st"], v["n"]), []).append(f)
trail = json.load(open(os.path.join(site, "public/watchdog/trail.json")))
out, miss = {}, []
for v in trail["visits"]:
    st, city = v["st"], v["city"]
    if not city: continue
    names = CITY.get(st, {}).get(city)
    if not names: miss.append(f"{st}|{city}"); continue
    fs = []
    for n in names:
        hit = by.get((st, n))
        if not hit or len(hit) != 1: miss.append(f"{st}|{city}|{n}"); continue
        fs.append(hit[0])
    if fs: out[f"{st}|{city}"] = fs
json.dump(out, open(os.path.join(site, "public/watchdog/stop_counties.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "cities mapped; missing:", sorted(set(miss)))
