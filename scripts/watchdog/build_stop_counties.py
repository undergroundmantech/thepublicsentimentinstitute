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
# Oct 23 2026 candidate stops
for _st, _m in {"AK": {"Anchorage": ["Anchorage"], "Juneau": ["Juneau"]}, "AR": {"Conway": ["Faulkner"], "Fayetteville": ["Washington"], "Jonesboro": ["Craighead"], "Little Rock": ["Pulaski"]}, "AZ": {"Buckeye": ["Maricopa"], "Mesa": ["Maricopa"], "Phoenix": ["Maricopa"], "Prescott": ["Yavapai"], "Somerton": ["Yuma"], "Tucson": ["Pima"], "Yuma": ["Yuma"]}, "FL": {"Fort Pierce": ["St. Lucie"], "Indian Rocks Beach": ["Pinellas"], "Lakewood Ranch": ["Manatee"], "Melbourne": ["Brevard"], "Miami": ["Miami-Dade"], "Miami Gardens": ["Miami-Dade"], "Pembroke Park": ["Broward"], "Plant City": ["Hillsborough"], "Weston": ["Broward"]}, "GA": {"Canton": ["Cherokee"], "Columbus": ["Muscogee"], "Doraville": ["DeKalb"], "Grovetown": ["Columbia"], "LaGrange": ["Troup"], "Peachtree City": ["Fayette"], "Savannah": ["Chatham"], "Stockbridge": ["Henry"], "Stonecrest": ["DeKalb"]}, "IA": {"Ames": ["Story"], "Carroll": ["Carroll"], "Cedar Falls": ["Black Hawk"], "Cedar Rapids": ["Linn"], "Corning": ["Adams"], "Davenport": ["Scott"], "Decorah": ["Winneshiek"], "Dunlap": ["Harrison"], "Elkader": ["Clayton"], "Forest City": ["Winnebago"], "Grinnell": ["Poweshiek"], "Independence": ["Buchanan"], "Johnston": ["Polk"], "Marshalltown": ["Marshall"], "Mason City": ["Cerro Gordo"], "Ottumwa": ["Wapello"], "Pella": ["Marion"], "St. Ansgar": ["Mitchell"], "Storm Lake": ["Buena Vista"], "Waterloo": ["Black Hawk"], "Waukee": ["Dallas"], "Waukon": ["Allamakee"], "Winterset": ["Madison"]}, "LA": {"Lafayette": ["Lafayette"]}, "ME": {"Auburn": ["Androscoggin"], "Augusta": ["Kennebec"], "Bath": ["Sagadahoc"], "Biddeford": ["York"], "Ellsworth": ["Hancock"], "Lewiston": ["Androscoggin"], "Norway": ["Oxford"], "Penobscot": ["Hancock"], "Waterville": ["Kennebec"], "Wells": ["York"]}, "MI": {"Battle Creek": ["Calhoun"], "East Lansing": ["Ingham"], "Escanaba": ["Delta"], "Flint": ["Genesee"], "Grand Rapids": ["Kent"], "Grosse Pointe": ["Wayne"], "Iron Mountain": ["Dickinson"], "Marquette": ["Marquette"], "Paw Paw": ["Van Buren"], "Saline Township": ["Washtenaw"], "Southfield": ["Oakland"], "St. Clair Shores": ["Macomb"], "Traverse City": ["Grand Traverse"]}, "MN": {"Apple Valley": ["Dakota"], "Appleton": ["Swift"], "Eden Prairie": ["Hennepin"], "Le Sueur": ["Le Sueur"], "Moorhead": ["Clay"], "St. Paul": ["Ramsey"]}, "MO": {"Kansas City": ["Jackson"]}, "MS": {"Vicksburg": ["Warren"]}, "NC": {"Asheville": ["Buncombe"], "Charlotte": ["Mecklenburg"], "Lillington": ["Harnett"], "Raleigh": ["Wake"], "Rocky Mount": ["Nash"]}, "NE": {"Arthur": ["Arthur"], "Hyannis": ["Grant"], "Omaha": ["Douglas"], "Red Cloud": ["Webster"]}, "NH": {"Goffstown": ["Hillsborough"], "Hanover": ["Grafton"], "Nashua": ["Hillsborough"], "North Conway": ["Carroll"], "Salem": ["Rockingham"], "Swanzey": ["Cheshire"]}, "OH": {"Boardman": ["Mahoning"], "Bowling Green": ["Wood"], "Circleville": ["Pickaway"], "Columbus": ["Franklin"], "Delaware": ["Delaware"], "Strongsville": ["Cuyahoga"]}, "OR": {"Bend": ["Deschutes"], "Eugene": ["Lane"], "Medford": ["Jackson"]}, "RI": {"Cranston": ["Providence"], "East Providence": ["Providence"], "Lincoln": ["Providence"], "Narragansett": ["Washington"], "Newport": ["Newport"], "North Smithfield": ["Providence"], "Portsmouth": ["Newport"], "Providence": ["Providence"], "Warren": ["Bristol"], "Warwick": ["Kent"], "Woonsocket": ["Providence"]}, "SC": {"Columbia": ["Richland"], "Florence": ["Florence"], "Mount Pleasant": ["Charleston"], "North Charleston": ["Charleston"], "Summerville": ["Dorchester"]}, "TX": {"Allen": ["Collin"], "Austin": ["Travis"], "Conroe": ["Montgomery"], "Fort Worth": ["Tarrant"], "Huntsville": ["Walker"], "Plano": ["Collin"], "Richmond": ["Fort Bend"], "Rockwall": ["Rockwall"], "San Angelo": ["Tom Green"], "Temple": ["Bell"]}, "VT": {"Colchester": ["Chittenden"]}, "WI": {"Altoona": ["Eau Claire"], "Antigo": ["Langlade"], "Appleton": ["Outagamie"], "Beloit": ["Rock"], "Big Bend": ["Waukesha"], "Black River Falls": ["Jackson"], "Brown Deer": ["Milwaukee"], "Burlington": ["Racine"], "Cedarburg": ["Ozaukee"], "Chippewa Falls": ["Chippewa"], "Cottage Grove": ["Dane"], "Crivitz": ["Marinette"], "Delafield": ["Waukesha"], "Elkhorn": ["Walworth"], "Franklin": ["Milwaukee"], "Green Bay": ["Brown"], "Harshaw": ["Oneida"], "Hayward": ["Sawyer"], "Hudson": ["St. Croix"], "Kenosha": ["Kenosha"], "La Crosse": ["La Crosse"], "Ladysmith": ["Rusk"], "Lancaster": ["Grant"], "Luxemburg": ["Kewaunee"], "Manitowoc": ["Manitowoc"], "Menomonie": ["Dunn"], "New Glarus": ["Green"], "Oak Creek": ["Milwaukee"], "Oconomowoc": ["Waukesha"], "Oshkosh": ["Winnebago"], "Pewaukee": ["Waukesha"], "Prairie du Chien": ["Crawford"], "Rhinelander": ["Oneida"], "Rice Lake": ["Barron"], "Richfield": ["Washington"], "Richland Center": ["Richland"], "Rothschild": ["Marathon"], "Shawano": ["Shawano"], "Sheboygan": ["Sheboygan"], "Spooner": ["Washburn"], "Stevens Point": ["Portage"], "Superior": ["Douglas"], "Tomahawk": ["Lincoln"], "Viroqua": ["Vernon"], "Watertown": ["Jefferson", "Dodge"], "Waukesha": ["Waukesha"], "Wausau": ["Marathon"], "West Bend": ["Washington"], "West Salem": ["La Crosse"], "Wisconsin Dells": ["Columbia", "Sauk"], "Wisconsin Rapids": ["Wood"]}}.items():
    CITY.setdefault(_st, {}).update(_m)
# Oct 23 2026 sweep
for _st, _m in {"GA": {"Locust Grove": ["Henry"], "Perry": ["Houston"]}, "IA": {"Dubuque": ["Dubuque"]}, "KS": {"Topeka": ["Shawnee"]},
                "MS": {"Clarksdale": ["Coahoma"], "Columbus": ["Lowndes"], "Corinth": ["Alcorn"]}, "NH": {"Manchester": ["Hillsborough"], "Portsmouth": ["Rockingham"]},
                "OH": {"Chillicothe": ["Ross"]}, "WI": {"Madison": ["Dane"], "Milwaukee": ["Milwaukee"]}}.items():
    CITY.setdefault(_st, {}).update(_m)
# Oct 27 2026 sweep
for _st, _m in {"FL": {"Clearwater": ["Pinellas"], "Eatonville": ["Orange"]}, "GA": {"Alpharetta": ["Fulton"], "Buford": ["Gwinnett"], "Jefferson": ["Jackson"]},
                "KS": {"Holton": ["Jackson"], "Pratt": ["Pratt"], "Salina": ["Saline"]}, "MI": {"Alpena": ["Alpena"], "Lansing": ["Ingham"], "Romeo": ["Macomb"]},
                "MT": {"Belgrade": ["Gallatin"]}, "NC": {"Kinston": ["Lenoir"], "Wilmington": ["New Hanover"]}, "NY": {"Rochester": ["Monroe"], "Staten Island": ["Richmond"]},
                "OH": {"Akron": ["Summit"], "Cincinnati": ["Hamilton"], "Dayton": ["Montgomery"]}, "PA": {"Lebanon": ["Lebanon"], "Pittsburgh": ["Allegheny"], "University Park": ["Centre"]},
                "SC": {"Rock Hill": ["York"]}, "TX": {"Amarillo": ["Potter"], "Inez": ["Victoria"], "Weatherford": ["Parker"]}}.items():
    CITY.setdefault(_st, {}).update(_m)
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
