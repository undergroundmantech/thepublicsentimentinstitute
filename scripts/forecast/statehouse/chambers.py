# Seats in each chamber and how its terms run, for the chambers on the 2026 ballot.
HOUSE = dict(AL=105, AK=40, AZ=60, AR=100, CA=80, CO=65, CT=151, DE=41, FL=120, GA=180, HI=51, ID=70, IL=118, IN=100, IA=100,
             KS=125, KY=100, ME=151, MD=141, MA=160, MI=110, MN=134, MO=163, MT=100, NV=42, NH=400, NM=70, NY=150, NC=120,
             ND=94, OH=99, OK=101, OR=60, PA=203, RI=75, SC=124, SD=70, TN=99, TX=150, UT=75, VT=150, WA=98, WV=100, WI=99, WY=62)
SENATE = dict(AL=35, AK=20, AZ=30, AR=35, CA=40, CO=35, CT=36, DE=21, FL=40, GA=56, HI=25, ID=35, IL=59, IN=50, IA=50,
              KY=38, ME=35, MD=47, MA=40, MI=38, MN=67, MO=34, MT=50, NV=21, NH=24, NY=63, NC=50, ND=47, OH=33, OK=48,
              OR=30, PA=50, RI=38, SD=35, TN=33, TX=31, UT=29, VT=30, WA=49, WV=34, WI=33, WY=31)
# not on the 2026 ballot: Kansas, New Mexico and South Carolina senates were elected in 2024 for four years;
# Louisiana, Mississippi, New Jersey and Virginia vote in odd years; Nebraska is nonpartisan
TWO_YEAR_SENATE = set("AZ CT GA ID ME MA NH NY NC RI SD VT".split())
FOUR_YEAR_HOUSE = set("AL MD ND".split())
ALL_UP_2022_COHORT = set("AL MD MI MN".split())      # four year senates all elected in 2022, all up in 2026
NAME = dict(house="House", senate="Senate")
HOUSE_NAME = dict(CA="Assembly", NY="Assembly", NV="Assembly", WI="Assembly", MD="House of Delegates", WV="House of Delegates")
