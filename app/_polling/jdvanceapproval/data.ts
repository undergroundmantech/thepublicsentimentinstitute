// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const GOLD_STANDARD_NAMES = [
  // Oct 22 2026, set by the publisher: the gold standard pollsters, weighted up in every average.
  "On Point Polling", "Big Data Poll", "Honest Poll", "Emerson", "Quantus",
  "New York Times", "NY Times", "NYT", "Wall Street Journal", "WSJ",
];

export const RAW_POLLS: Poll[] = [
  // ── Added Nov 21, 2026: post midterm favorability ──
  { pollster: "Reuters/Ipsos", endDate: "2026-11-16", sampleSize: 1199, sampleType: "RV", results: { Favorable: 39, Unfavorable: 55 } },   // Nov 13 to 16, registered voters; 35 to 53 among all 1,521 adults
  { pollster: "Economist/YouGov", endDate: "2026-11-16", sampleSize: 1386, sampleType: "RV", results: { Favorable: 38, Unfavorable: 56 } },   // Nov 13 to 16, registered voters; 35 to 52 among all 1,628 citizens
  { pollster: "Echelon Insights (R)", endDate: "2026-11-16", sampleSize: 1027, sampleType: "LV", results: { Favorable: 40, Unfavorable: 53 } },   // Nov 12 to 16, verified voters in the likely electorate
  // ── Added Nov 21, 2026: April through November, every Vance favorability poll on the RealClearPolling list plus Echelon, Navigator, Clarity and Verasight ──
  { pollster: "Pew Research", endDate: "2026-11-15", sampleSize: 5044, sampleType: "A", results: { Favorable: 35, Unfavorable: 54 } },   // 11/9 to 11/15; sample size not listed, this pollster's usual one
  { pollster: "Economist/YouGov", endDate: "2026-11-11", sampleSize: 1463, sampleType: "RV", results: { Favorable: 40, Unfavorable: 55 } },   // 11/9 to 11/11
  { pollster: "Reuters/Ipsos", endDate: "2026-11-09", sampleSize: 1352, sampleType: "RV", results: { Favorable: 38, Unfavorable: 55 } },   // 11/6 to 11/9
  { pollster: "Economist/YouGov", endDate: "2026-11-06", sampleSize: 3166, sampleType: "RV", results: { Favorable: 39, Unfavorable: 53 } },   // 11/4 to 11/6
  { pollster: "Cygnal (R)", endDate: "2026-11-05", sampleSize: 3000, sampleType: "LV", results: { Favorable: 39, Unfavorable: 57 } },   // 11/4 to 11/5
  { pollster: "Reuters/Ipsos", endDate: "2026-11-02", sampleSize: 1357, sampleType: "RV", results: { Favorable: 40, Unfavorable: 54 } },   // 10/29 to 11/2
  { pollster: "Focaldata", endDate: "2026-11-01", sampleSize: 1537, sampleType: "RV", results: { Favorable: 40, Unfavorable: 51 } },   // 10/30 to 11/1; sample size not listed, this pollster's usual one
  { pollster: "Morning Consult", endDate: "2026-11-01", sampleSize: 2200, sampleType: "RV", results: { Favorable: 41, Unfavorable: 48 } },   // 10/30 to 11/1
  { pollster: "Atlas Intel", endDate: "2026-11-01", sampleSize: 2315, sampleType: "A", results: { Favorable: 38, Unfavorable: 58 } },   // 10/28 to 11/1; sample size not listed, this pollster's usual one
  { pollster: "Harvard-Harris", endDate: "2026-10-26", sampleSize: 2700, sampleType: "RV", results: { Favorable: 39, Unfavorable: 47 } },   // 10/24 to 10/26
  { pollster: "Economist/YouGov", endDate: "2026-10-26", sampleSize: 1440, sampleType: "RV", results: { Favorable: 41, Unfavorable: 55 } },   // 10/23 to 10/26
  { pollster: "Morning Consult", endDate: "2026-10-25", sampleSize: 2201, sampleType: "RV", results: { Favorable: 44, Unfavorable: 48 } },   // 10/19 to 10/25; sample size not listed, this pollster's usual one
  { pollster: "Focaldata", endDate: "2026-10-20", sampleSize: 1549, sampleType: "LV", results: { Favorable: 39, Unfavorable: 50 } },   // 10/16 to 10/20
  { pollster: "Reuters/Ipsos", endDate: "2026-10-19", sampleSize: 1330, sampleType: "RV", results: { Favorable: 37, Unfavorable: 57 } },   // 10/16 to 10/19; registered voter count not listed, about four in five of the adult sample
  { pollster: "Morning Consult", endDate: "2026-10-18", sampleSize: 2202, sampleType: "RV", results: { Favorable: 43, Unfavorable: 48 } },   // 10/16 to 10/18
  { pollster: "Morning Consult", endDate: "2026-10-11", sampleSize: 2204, sampleType: "RV", results: { Favorable: 44, Unfavorable: 45 } },   // 10/9 to 10/11
  { pollster: "NewsNation", endDate: "2026-10-09", sampleSize: 974, sampleType: "LV", results: { Favorable: 44, Unfavorable: 52 } },   // 10/5 to 10/9
  { pollster: "RMG Research", endDate: "2026-10-06", sampleSize: 2000, sampleType: "RV", results: { Favorable: 43, Unfavorable: 48 } },   // 10/5 to 10/6
  { pollster: "Focaldata", endDate: "2026-10-06", sampleSize: 1537, sampleType: "RV", results: { Favorable: 39, Unfavorable: 49 } },   // 10/3 to 10/6; sample size not listed, this pollster's usual one
  { pollster: "Morning Consult", endDate: "2026-10-05", sampleSize: 2202, sampleType: "RV", results: { Favorable: 44, Unfavorable: 46 } },   // 10/4 to 10/5
  { pollster: "Reuters/Ipsos", endDate: "2026-10-05", sampleSize: 3526, sampleType: "RV", results: { Favorable: 39, Unfavorable: 55 } },   // 9/30 to 10/5
  { pollster: "I&I/TIPP", endDate: "2026-10-01", sampleSize: 1488, sampleType: "A", results: { Favorable: 41, Unfavorable: 41 } },   // 9/29 to 10/1
  { pollster: "Harvard-Harris", endDate: "2026-09-28", sampleSize: 2200, sampleType: "RV", results: { Favorable: 41, Unfavorable: 44 } },   // 9/26 to 9/28
  { pollster: "Morning Consult", endDate: "2026-09-27", sampleSize: 18786, sampleType: "RV", results: { Favorable: 43, Unfavorable: 46 } },   // 9/25 to 9/27
  { pollster: "Wall Street Journal", endDate: "2026-09-21", sampleSize: 1500, sampleType: "RV", results: { Favorable: 41, Unfavorable: 54 } },   // 9/16 to 9/21
  { pollster: "Morning Consult", endDate: "2026-09-20", sampleSize: 2201, sampleType: "RV", results: { Favorable: 42, Unfavorable: 47 } },   // 9/18 to 9/20
  { pollster: "Reuters/Ipsos", endDate: "2026-09-20", sampleSize: 979, sampleType: "RV", results: { Favorable: 38, Unfavorable: 56 } },   // 9/17 to 9/20
  { pollster: "NBC News", endDate: "2026-09-15", sampleSize: 1000, sampleType: "RV", results: { Favorable: 37, Unfavorable: 48 } },   // 9/11 to 9/15
  { pollster: "Reuters/Ipsos", endDate: "2026-09-14", sampleSize: 900, sampleType: "RV", results: { Favorable: 40, Unfavorable: 55 } },   // 9/11 to 9/14; registered voter count not listed, about four in five of the adult sample
  { pollster: "Morning Consult", endDate: "2026-09-13", sampleSize: 2203, sampleType: "RV", results: { Favorable: 42, Unfavorable: 45 } },   // 9/11 to 9/13
  { pollster: "Marquette", endDate: "2026-09-09", sampleSize: 581, sampleType: "LV", results: { Favorable: 40, Unfavorable: 57 } },   // 9/2 to 9/9
  { pollster: "Focaldata", endDate: "2026-09-02", sampleSize: 1837, sampleType: "LV", results: { Favorable: 39, Unfavorable: 45 } },   // 8/28 to 9/2
  { pollster: "Harvard-Harris", endDate: "2026-08-30", sampleSize: 2100, sampleType: "RV", results: { Favorable: 40, Unfavorable: 45 } },   // 8/28 to 8/30
  { pollster: "RMG Research", endDate: "2026-08-25", sampleSize: 3000, sampleType: "RV", results: { Favorable: 48, Unfavorable: 44 } },   // 8/24 to 8/25
  { pollster: "Reuters/Ipsos", endDate: "2026-08-24", sampleSize: 951, sampleType: "RV", results: { Favorable: 39, Unfavorable: 55 } },   // 8/21 to 8/24
  { pollster: "Morning Consult", endDate: "2026-08-17", sampleSize: 2201, sampleType: "RV", results: { Favorable: 43, Unfavorable: 46 } },   // 8/14 to 8/17; sample size not listed, this pollster's usual one
  { pollster: "Economist/YouGov", endDate: "2026-08-10", sampleSize: 1420, sampleType: "RV", results: { Favorable: 40, Unfavorable: 53 } },   // 8/7 to 8/10
  { pollster: "Cygnal (R)", endDate: "2026-08-07", sampleSize: 1500, sampleType: "LV", results: { Favorable: 41, Unfavorable: 52 } },   // 8/6 to 8/7
  { pollster: "Reuters/Ipsos", endDate: "2026-08-03", sampleSize: 3542, sampleType: "RV", results: { Favorable: 39, Unfavorable: 55 } },   // 7/29 to 8/3
  { pollster: "Morning Consult", endDate: "2026-08-02", sampleSize: 2200, sampleType: "RV", results: { Favorable: 44, Unfavorable: 45 } },   // 7/31 to 8/2
  { pollster: "I&I/TIPP", endDate: "2026-08-01", sampleSize: 1463, sampleType: "A", results: { Favorable: 38, Unfavorable: 40 } },   // 7/28 to 8/1
  { pollster: "Marquette", endDate: "2026-07-29", sampleSize: 572, sampleType: "LV", results: { Favorable: 41, Unfavorable: 56 } },   // 7/22 to 7/29
  { pollster: "Morning Consult", endDate: "2026-07-26", sampleSize: 2200, sampleType: "RV", results: { Favorable: 43, Unfavorable: 45 } },   // 7/24 to 7/26
  { pollster: "Reuters/Ipsos", endDate: "2026-07-26", sampleSize: 1003, sampleType: "RV", results: { Favorable: 41, Unfavorable: 54 } },   // 7/24 to 7/26
  { pollster: "FOX News", endDate: "2026-07-20", sampleSize: 1003, sampleType: "RV", results: { Favorable: 41, Unfavorable: 54 } },   // 7/17 to 7/20
  { pollster: "RMG Research", endDate: "2026-07-14", sampleSize: 2000, sampleType: "RV", results: { Favorable: 45, Unfavorable: 43 } },   // 7/13 to 7/14
  { pollster: "Harvard-Harris", endDate: "2026-07-12", sampleSize: 1776, sampleType: "RV", results: { Favorable: 40, Unfavorable: 43 } },   // 7/11 to 7/12
  { pollster: "HarrisX", endDate: "2026-07-10", sampleSize: 787, sampleType: "LV", results: { Favorable: 45, Unfavorable: 46 } },   // 7/9 to 7/10
  { pollster: "Morning Consult", endDate: "2026-07-06", sampleSize: 2200, sampleType: "RV", results: { Favorable: 44, Unfavorable: 45 } },   // 7/3 to 7/6
  { pollster: "Cygnal (R)", endDate: "2026-07-01", sampleSize: 1500, sampleType: "LV", results: { Favorable: 41, Unfavorable: 53 } },   // 6/30 to 7/1
  { pollster: "Focaldata", endDate: "2026-06-29", sampleSize: 1795, sampleType: "RV", results: { Favorable: 38, Unfavorable: 44 } },   // 6/26 to 6/29
  { pollster: "Morning Consult", endDate: "2026-06-28", sampleSize: 2202, sampleType: "RV", results: { Favorable: 38, Unfavorable: 47 } },   // 6/26 to 6/28
  { pollster: "Morning Consult", endDate: "2026-06-22", sampleSize: 2200, sampleType: "RV", results: { Favorable: 42, Unfavorable: 46 } },   // 6/19 to 6/22
  { pollster: "Reuters/Ipsos", endDate: "2026-06-22", sampleSize: 978, sampleType: "RV", results: { Favorable: 41, Unfavorable: 53 } },   // 6/18 to 6/22
  { pollster: "Echelon Insights (R)", endDate: "2026-06-22", sampleSize: 1003, sampleType: "LV", results: { Favorable: 41, Unfavorable: 52 } },   // June omnibus
  { pollster: "Echelon Insights (R)", endDate: "2026-06-14", sampleSize: 1012, sampleType: "LV", results: { Favorable: 43, Unfavorable: 50 } },
  { pollster: "Navigator Research", endDate: "2026-06-08", sampleSize: 1000, sampleType: "RV", results: { Favorable: 40, Unfavorable: 52 } },   // Global Strategy Group for Navigator
  { pollster: "Morning Consult", endDate: "2026-06-07", sampleSize: 2200, sampleType: "RV", results: { Favorable: 42, Unfavorable: 46 } },   // 6/5 to 6/7
  { pollster: "Forbes/HarrisX", endDate: "2026-06-07", sampleSize: 1137, sampleType: "LV", results: { Favorable: 46, Unfavorable: 44 } },   // 5/20 to 6/7
  { pollster: "Clarity Campaign Labs (D)", endDate: "2026-06-05", sampleSize: 1045, sampleType: "LV", results: { Favorable: 43, Unfavorable: 46 } },
  { pollster: "RMG Research", endDate: "2026-06-04", sampleSize: 1000, sampleType: "RV", results: { Favorable: 47, Unfavorable: 49 } },   // 6/3 to 6/4
  { pollster: "Cygnal (R)", endDate: "2026-06-03", sampleSize: 1500, sampleType: "LV", results: { Favorable: 44, Unfavorable: 52 } },   // 6/2 to 6/3
  { pollster: "The Argument/Verasight", endDate: "2026-06-03", sampleSize: 3008, sampleType: "RV", results: { Favorable: 39, Unfavorable: 54 } },
  { pollster: "Focaldata", endDate: "2026-06-01", sampleSize: 1537, sampleType: "RV", results: { Favorable: 40, Unfavorable: 41 } },   // 5/29 to 6/1
  { pollster: "Economist/YouGov", endDate: "2026-06-01", sampleSize: 806, sampleType: "RV", results: { Favorable: 44, Unfavorable: 52 } },   // 5/29 to 6/1
  { pollster: "Harvard-Harris", endDate: "2026-05-31", sampleSize: 1725, sampleType: "RV", results: { Favorable: 41, Unfavorable: 42 } },   // 5/29 to 5/31
  { pollster: "I&I/TIPP", endDate: "2026-05-28", sampleSize: 1589, sampleType: "A", results: { Favorable: 36, Unfavorable: 42 } },   // 5/26 to 5/28
  { pollster: "Economist/YouGov", endDate: "2026-05-26", sampleSize: 1397, sampleType: "RV", results: { Favorable: 41, Unfavorable: 55 } },   // 5/22 to 5/26
  { pollster: "Marquette", endDate: "2026-05-26", sampleSize: 857, sampleType: "RV", results: { Favorable: 42, Unfavorable: 53 } },   // 5/20 to 5/26
  { pollster: "Morning Consult", endDate: "2026-05-24", sampleSize: 2204, sampleType: "RV", results: { Favorable: 42, Unfavorable: 47 } },   // 5/22 to 5/24
  { pollster: "Reuters/Ipsos", endDate: "2026-05-18", sampleSize: 1271, sampleType: "A", results: { Favorable: 34, Unfavorable: 57 } },   // 5/15 to 5/18
  { pollster: "Echelon Insights (R)", endDate: "2026-05-18", sampleSize: 1008, sampleType: "LV", results: { Favorable: 39, Unfavorable: 53 } },
  { pollster: "Morning Consult", endDate: "2026-05-17", sampleSize: 2203, sampleType: "RV", results: { Favorable: 42, Unfavorable: 46 } },   // 5/15 to 5/17
  { pollster: "Economist/YouGov", endDate: "2026-05-11", sampleSize: 1403, sampleType: "RV", results: { Favorable: 43, Unfavorable: 52 } },   // 5/9 to 5/11
  { pollster: "Atlas Intel", endDate: "2026-05-07", sampleSize: 2069, sampleType: "A", results: { Favorable: 37, Unfavorable: 58 } },   // 5/4 to 5/7
  { pollster: "Cygnal (R)", endDate: "2026-05-06", sampleSize: 1500, sampleType: "LV", results: { Favorable: 43, Unfavorable: 51 } },   // 5/5 to 5/6
  { pollster: "Focaldata", endDate: "2026-05-05", sampleSize: 3612, sampleType: "A", results: { Favorable: 37, Unfavorable: 44 } },   // 5/1 to 5/5
  { pollster: "Forbes/HarrisX", endDate: "2026-05-05", sampleSize: 1891, sampleType: "LV", results: { Favorable: 43, Unfavorable: 43 } },   // 4/29 to 5/5
  { pollster: "I&I/TIPP", endDate: "2026-05-01", sampleSize: 1464, sampleType: "A", results: { Favorable: 37, Unfavorable: 43 } },   // 4/28 to 5/1
  { pollster: "Morning Consult", endDate: "2026-04-27", sampleSize: 2201, sampleType: "RV", results: { Favorable: 42, Unfavorable: 45 } },   // 4/24 to 4/27
  { pollster: "Reuters/Ipsos", endDate: "2026-04-27", sampleSize: 1269, sampleType: "A", results: { Favorable: 35, Unfavorable: 54 } },   // 4/24 to 4/27
  { pollster: "Harvard-Harris", endDate: "2026-04-26", sampleSize: 2745, sampleType: "RV", results: { Favorable: 41, Unfavorable: 42 } },   // 4/23 to 4/26
  { pollster: "RMG Research", endDate: "2026-04-23", sampleSize: 1000, sampleType: "RV", results: { Favorable: 40, Unfavorable: 52 } },   // 4/22 to 4/23
  // 2026
  { pollster: "Economist/YouGov", endDate: "2026-03-16", sampleSize: 1429, sampleType: "RV", results: { Favorable: 41, Unfavorable: 52 } },
  { pollster: "NBC News", endDate: "2026-03-03", sampleSize: 1000, sampleType: "RV", results: { Favorable: 38, Unfavorable: 49 } },
  { pollster: "Harvard-Harris", endDate: "2026-02-26", sampleSize: 1999, sampleType: "RV", results: { Favorable: 40, Unfavorable: 45 } },
  { pollster: "On Point Polling", endDate: "2026-02-28", sampleSize: 316, sampleType: "RV", results: { Favorable: 33.6, Unfavorable: 53.3 } },
  { pollster: "On Point Polling", endDate: "2026-02-28", sampleSize: 249, sampleType: "LV", results: { Favorable: 38.8, Unfavorable: 57.5 } },
  { pollster: "Morning Consult", endDate: "2026-02-22", sampleSize: 2202, sampleType: "RV", results: { Favorable: 40, Unfavorable: 49 } },
  { pollster: "Big Data Poll", endDate: "2026-02-18", sampleSize: 2012, sampleType: "RV", results: { Favorable: 41, Unfavorable: 51 } },
  { pollster: "Morning Consult", endDate: "2026-02-16", sampleSize: 2200, sampleType: "RV", results: { Favorable: 40, Unfavorable: 46 } },
  { pollster: "Economist/YouGov", endDate: "2026-02-16", sampleSize: 1512, sampleType: "RV", results: { Favorable: 41, Unfavorable: 53 } },
  { pollster: "Reuters/Ipsos", endDate: "2026-02-16", sampleSize: 1117, sampleType: "A", results: { Favorable: 36, Unfavorable: 53 } },
  { pollster: "Morning Consult", endDate: "2026-02-09", sampleSize: 2200, sampleType: "RV", results: { Favorable: 41, Unfavorable: 46 } },
  { pollster: "Morning Consult", endDate: "2026-02-01", sampleSize: 2201, sampleType: "RV", results: { Favorable: 41, Unfavorable: 47 } },
  { pollster: "Harvard-Harris", endDate: "2026-01-29", sampleSize: 2000, sampleType: "RV", results: { Favorable: 38, Unfavorable: 42 } },
  { pollster: "Marquette", endDate: "2026-01-28", sampleSize: 869, sampleType: "RV", results: { Favorable: 42, Unfavorable: 54 } },
  { pollster: "Morning Consult", endDate: "2026-01-25", sampleSize: 2201, sampleType: "RV", results: { Favorable: 41, Unfavorable: 47 } },
  { pollster: "Pew Research", endDate: "2026-01-26", sampleSize: 4250, sampleType: "A", results: { Favorable: 38, Unfavorable: 52 } },
  { pollster: "Emerson", endDate: "2026-01-19", sampleSize: 1000, sampleType: "LV", results: { Favorable: 42, Unfavorable: 46 } },
  { pollster: "Wall Street Journal", endDate: "2026-01-13", sampleSize: 1500, sampleType: "RV", results: { Favorable: 44, Unfavorable: 51 } },
  { pollster: "Morning Consult", endDate: "2026-01-12", sampleSize: 2201, sampleType: "RV", results: { Favorable: 40, Unfavorable: 46 } },
  { pollster: "Economist/YouGov", endDate: "2026-01-12", sampleSize: 1437, sampleType: "RV", results: { Favorable: 41, Unfavorable: 54 } },
  { pollster: "Cygnal (R)", endDate: "2026-01-08", sampleSize: 1500, sampleType: "LV", results: { Favorable: 42, Unfavorable: 51 } },
  { pollster: "Rasmussen Reports (R)", endDate: "2026-01-06", sampleSize: 1122, sampleType: "LV", results: { Favorable: 44, Unfavorable: 51 } },
  { pollster: "Morning Consult", endDate: "2026-01-04", sampleSize: 2201, sampleType: "RV", results: { Favorable: 42, Unfavorable: 44 } },

  // 2025 December
  { pollster: "Economist/YouGov", endDate: "2025-12-29", sampleSize: 1420, sampleType: "RV", results: { Favorable: 40, Unfavorable: 54 } },
  { pollster: "Morning Consult", endDate: "2025-12-21", sampleSize: 2203, sampleType: "RV", results: { Favorable: 42, Unfavorable: 44 } },
  { pollster: "RMG Research", endDate: "2025-12-18", sampleSize: 1000, sampleType: "RV", results: { Favorable: 50, Unfavorable: 44 } },
  { pollster: "Atlas Intel", endDate: "2025-12-19", sampleSize: 2315, sampleType: "A", results: { Favorable: 37, Unfavorable: 60 } },
  { pollster: "Quantus Insights", endDate: "2025-12-16", sampleSize: 1000, sampleType: "RV", results: { Favorable: 41, Unfavorable: 47 } },
  { pollster: "Emerson", endDate: "2025-12-15", sampleSize: 1000, sampleType: "RV", results: { Favorable: 46, Unfavorable: 41 } },
  { pollster: "Morning Consult", endDate: "2025-12-07", sampleSize: 2201, sampleType: "RV", results: { Favorable: 42, Unfavorable: 44 } },
  { pollster: "Harvard-Harris", endDate: "2025-12-04", sampleSize: 2204, sampleType: "RV", results: { Favorable: 40, Unfavorable: 40 } },
  { pollster: "Morning Consult", endDate: "2025-11-23", sampleSize: 2200, sampleType: "RV", results: { Favorable: 41, Unfavorable: 44 } },
  { pollster: "Marquette", endDate: "2025-11-12", sampleSize: 1052, sampleType: "A", results: { Favorable: 36, Unfavorable: 52 } },
  { pollster: "Economist/YouGov", endDate: "2025-11-10", sampleSize: 1500, sampleType: "RV", results: { Favorable: 43, Unfavorable: 51 } },
  { pollster: "Harvard-Harris", endDate: "2025-11-06", sampleSize: 2000, sampleType: "RV", results: { Favorable: 40, Unfavorable: 43 } },
  { pollster: "I&I/TIPP", endDate: "2025-10-31", sampleSize: 1418, sampleType: "A", results: { Favorable: 37, Unfavorable: 38 } },
  { pollster: "Big Data Poll", endDate: "2025-10-28", sampleSize: 2984, sampleType: "RV", results: { Favorable: 45, Unfavorable: 46 } },
  { pollster: "NBC News", endDate: "2025-10-28", sampleSize: 1000, sampleType: "RV", results: { Favorable: 39, Unfavorable: 45 } },
  { pollster: "Emerson", endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Favorable: 43, Unfavorable: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-10-13", sampleSize: 1467, sampleType: "RV", results: { Favorable: 43, Unfavorable: 50 } },
  { pollster: "Harvard-Harris", endDate: "2025-10-02", sampleSize: 2413, sampleType: "RV", results: { Favorable: 40, Unfavorable: 42 } },
  { pollster: "RMG Research", endDate: "2025-10-01", sampleSize: 1000, sampleType: "RV", results: { Favorable: 47, Unfavorable: 47 } },
  { pollster: "Pew Research", endDate: "2025-09-28", sampleSize: 1718, sampleType: "A", results: { Favorable: 40, Unfavorable: 51 } },
  { pollster: "Marquette", endDate: "2025-09-24", sampleSize: 1043, sampleType: "A", results: { Favorable: 39, Unfavorable: 50 } },
  { pollster: "Rasmussen Reports (R)", endDate: "2025-09-18", sampleSize: 1165, sampleType: "LV", results: { Favorable: 51, Unfavorable: 43 } },
  { pollster: "Atlas Intel", endDate: "2025-09-16", sampleSize: 1066, sampleType: "A", results: { Favorable: 45, Unfavorable: 52 } },
  { pollster: "Economist/YouGov", endDate: "2025-09-15", sampleSize: 1420, sampleType: "RV", results: { Favorable: 41, Unfavorable: 50 } },
  { pollster: "FOX News", endDate: "2025-09-09", sampleSize: 1004, sampleType: "RV", results: { Favorable: 41, Unfavorable: 53 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-08-24", sampleSize: 1022, sampleType: "A", results: { Favorable: 39, Unfavorable: 53 } },
  { pollster: "RMG Research", endDate: "2025-08-21", sampleSize: 1000, sampleType: "RV", results: { Favorable: 48, Unfavorable: 46 } },
  { pollster: "Harvard-Harris", endDate: "2025-08-21", sampleSize: 2025, sampleType: "RV", results: { Favorable: 39, Unfavorable: 41 } },
  { pollster: "Economist/YouGov", endDate: "2025-08-11", sampleSize: 1474, sampleType: "RV", results: { Favorable: 44, Unfavorable: 50 } },
  { pollster: "Cygnal (R)", endDate: "2025-08-09", sampleSize: 1500, sampleType: "RV", results: { Favorable: 45, Unfavorable: 48 } },
  { pollster: "Morning Consult", endDate: "2025-08-03", sampleSize: 2201, sampleType: "RV", results: { Favorable: 40, Unfavorable: 45 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-07-16", sampleSize: 1027, sampleType: "A", results: { Favorable: 38, Unfavorable: 52 } },
  { pollster: "Atlas Intel", endDate: "2025-07-18", sampleSize: 1935, sampleType: "A", results: { Favorable: 44, Unfavorable: 55 } },
  { pollster: "Gallup", endDate: "2025-07-21", sampleSize: 750, sampleType: "A", results: { Favorable: 38, Unfavorable: 49 } },
  { pollster: "Big Data Poll", endDate: "2025-07-14", sampleSize: 3022, sampleType: "RV", results: { Favorable: 45, Unfavorable: 46 } },
  { pollster: "Economist/YouGov", endDate: "2025-07-14", sampleSize: 1506, sampleType: "RV", results: { Favorable: 41, Unfavorable: 52 } },
  { pollster: "Marquette", endDate: "2025-07-16", sampleSize: 1005, sampleType: "A", results: { Favorable: 38, Unfavorable: 49 } },
  { pollster: "RMG Research", endDate: "2025-07-08", sampleSize: 1000, sampleType: "RV", results: { Favorable: 46, Unfavorable: 43 } },
  { pollster: "Harvard-Harris", endDate: "2025-07-08", sampleSize: 2044, sampleType: "RV", results: { Favorable: 39, Unfavorable: 41 } },
  { pollster: "Cygnal (R)", endDate: "2025-07-02", sampleSize: 1500, sampleType: "LV", results: { Favorable: 45, Unfavorable: 48 } },
  { pollster: "Economist/YouGov", endDate: "2025-06-30", sampleSize: 1491, sampleType: "RV", results: { Favorable: 42, Unfavorable: 53 } },
  { pollster: "I&I/TIPP", endDate: "2025-06-27", sampleSize: 1421, sampleType: "A", results: { Favorable: 39, Unfavorable: 37 } },
  { pollster: "FOX News", endDate: "2025-06-16", sampleSize: 1003, sampleType: "RV", results: { Favorable: 44, Unfavorable: 53 } },
  { pollster: "Economist/YouGov", endDate: "2025-06-16", sampleSize: 1351, sampleType: "RV", results: { Favorable: 42, Unfavorable: 52 } },
  { pollster: "Harvard-Harris", endDate: "2025-06-12", sampleSize: 2097, sampleType: "RV", results: { Favorable: 41, Unfavorable: 39 } },
  { pollster: "Quinnipiac", endDate: "2025-06-09", sampleSize: 1265, sampleType: "RV", results: { Favorable: 35, Unfavorable: 48 } },
  { pollster: "Atlas Intel", endDate: "2025-05-27", sampleSize: 3469, sampleType: "A", results: { Favorable: 42, Unfavorable: 56 } },
  { pollster: "Quantus Insights", endDate: "2025-05-20", sampleSize: 1000, sampleType: "RV", results: { Favorable: 43, Unfavorable: 45 } },
  { pollster: "Economist/YouGov", endDate: "2025-05-19", sampleSize: 1558, sampleType: "RV", results: { Favorable: 42, Unfavorable: 51 } },
  { pollster: "Harvard-Harris", endDate: "2025-05-15", sampleSize: 1903, sampleType: "RV", results: { Favorable: 41, Unfavorable: 41 } },
  { pollster: "Economist/YouGov", endDate: "2025-05-12", sampleSize: 1610, sampleType: "RV", results: { Favorable: 42, Unfavorable: 53 } },
  { pollster: "Marquette", endDate: "2025-05-15", sampleSize: 1004, sampleType: "A", results: { Favorable: 38, Unfavorable: 50 } },
  { pollster: "Economist/YouGov", endDate: "2025-05-05", sampleSize: 1693, sampleType: "RV", results: { Favorable: 42, Unfavorable: 52 } },
  { pollster: "Big Data Poll", endDate: "2025-05-05", sampleSize: 3128, sampleType: "RV", results: { Favorable: 47, Unfavorable: 44 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-28", sampleSize: 1626, sampleType: "RV", results: { Favorable: 41, Unfavorable: 54 } },
  { pollster: "Yahoo News", endDate: "2025-04-28", sampleSize: 1071, sampleType: "RV", results: { Favorable: 41, Unfavorable: 52 } },
  { pollster: "Emerson", endDate: "2025-04-28", sampleSize: 1000, sampleType: "RV", results: { Favorable: 39, Unfavorable: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-22", sampleSize: 1446, sampleType: "RV", results: { Favorable: 42, Unfavorable: 52 } },
  { pollster: "RMG Research", endDate: "2025-04-16", sampleSize: 1000, sampleType: "RV", results: { Favorable: 46, Unfavorable: 47 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-15", sampleSize: 1329, sampleType: "RV", results: { Favorable: 42, Unfavorable: 52 } },
  { pollster: "Atlas Intel", endDate: "2025-04-14", sampleSize: 2347, sampleType: "A", results: { Favorable: 45, Unfavorable: 54 } },
  { pollster: "Harvard-Harris", endDate: "2025-04-10", sampleSize: 2286, sampleType: "RV", results: { Favorable: 41, Unfavorable: 39 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-08", sampleSize: 1563, sampleType: "RV", results: { Favorable: 42, Unfavorable: 52 } },
  { pollster: "Morning Consult", endDate: "2025-04-06", sampleSize: 2207, sampleType: "RV", results: { Favorable: 42, Unfavorable: 46 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-04-02", sampleSize: 1486, sampleType: "A", results: { Favorable: 41, Unfavorable: 49 } },
  { pollster: "Economist/YouGov", endDate: "2025-04-01", sampleSize: 1465, sampleType: "RV", results: { Favorable: 43, Unfavorable: 52 } },
  { pollster: "Wall Street Journal", endDate: "2025-04-01", sampleSize: 1500, sampleType: "RV", results: { Favorable: 43, Unfavorable: 50 } },
  { pollster: "TIPP", endDate: "2025-03-28", sampleSize: 1452, sampleType: "A", results: { Favorable: 38, Unfavorable: 37 } },
  { pollster: "Harvard-Harris", endDate: "2025-03-27", sampleSize: 2746, sampleType: "RV", results: { Favorable: 40, Unfavorable: 41 } },
  { pollster: "Rasmussen Reports (R)", endDate: "2025-03-27", sampleSize: 1036, sampleType: "LV", results: { Favorable: 49, Unfavorable: 45 } },
  { pollster: "Quantus Insights", endDate: "2025-03-27", sampleSize: 1000, sampleType: "RV", results: { Favorable: 45, Unfavorable: 47 } },
  { pollster: "Economist/YouGov", endDate: "2025-03-25", sampleSize: 1440, sampleType: "RV", results: { Favorable: 45, Unfavorable: 51 } },
  { pollster: "Marquette", endDate: "2025-03-27", sampleSize: 1021, sampleType: "A", results: { Favorable: 37, Unfavorable: 50 } },
  { pollster: "Economist/YouGov", endDate: "2025-03-18", sampleSize: 1458, sampleType: "RV", results: { Favorable: 45, Unfavorable: 49 } },
  { pollster: "Atlas Intel", endDate: "2025-03-12", sampleSize: 2550, sampleType: "A", results: { Favorable: 51, Unfavorable: 49 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-03-12", sampleSize: 1422, sampleType: "A", results: { Favorable: 40, Unfavorable: 50 } },
  { pollster: "Economist/YouGov", endDate: "2025-03-11", sampleSize: 1532, sampleType: "RV", results: { Favorable: 45, Unfavorable: 50 } },
  { pollster: "NBC News", endDate: "2025-03-11", sampleSize: 1000, sampleType: "RV", results: { Favorable: 41, Unfavorable: 47 } },
  { pollster: "Quinnipiac", endDate: "2025-03-10", sampleSize: 1198, sampleType: "RV", results: { Favorable: 39, Unfavorable: 48 } },
  { pollster: "CNN", endDate: "2025-03-09", sampleSize: 0, sampleType: "RV", results: { Favorable: 39, Unfavorable: 47 } },
  { pollster: "Emerson", endDate: "2025-03-10", sampleSize: 1000, sampleType: "RV", results: { Favorable: 42, Unfavorable: 46 } },
  { pollster: "Economist/YouGov", endDate: "2025-03-04", sampleSize: 1491, sampleType: "RV", results: { Favorable: 45, Unfavorable: 48 } },
  { pollster: "Atlas Intel", endDate: "2025-02-27", sampleSize: 2849, sampleType: "A", results: { Favorable: 51, Unfavorable: 48 } },
  { pollster: "Economist/YouGov", endDate: "2025-02-25", sampleSize: 1444, sampleType: "RV", results: { Favorable: 44, Unfavorable: 48 } },
  { pollster: "Morning Consult", endDate: "2025-02-24", sampleSize: 2225, sampleType: "RV", results: { Favorable: 44, Unfavorable: 42 } },
  { pollster: "Harvard-Harris", endDate: "2025-02-20", sampleSize: 2443, sampleType: "RV", results: { Favorable: 42, Unfavorable: 38 } },
  { pollster: "Economist/YouGov", endDate: "2025-02-18", sampleSize: 1451, sampleType: "RV", results: { Favorable: 46, Unfavorable: 48 } },
  { pollster: "Reuters/Ipsos", endDate: "2025-02-18", sampleSize: 4125, sampleType: "A", results: { Favorable: 41, Unfavorable: 46 } },
  { pollster: "Quinnipiac", endDate: "2025-02-17", sampleSize: 1039, sampleType: "RV", results: { Favorable: 38, Unfavorable: 39 } },
  { pollster: "Economist/YouGov", endDate: "2025-02-11", sampleSize: 1430, sampleType: "RV", results: { Favorable: 44, Unfavorable: 50 } },
  { pollster: "Economist/YouGov", endDate: "2025-02-04", sampleSize: 1423, sampleType: "RV", results: { Favorable: 44, Unfavorable: 50 } },
  { pollster: "Morning Consult", endDate: "2025-02-03", sampleSize: 2303, sampleType: "RV", results: { Favorable: 42, Unfavorable: 43 } },
  { pollster: "Marquette", endDate: "2025-02-05", sampleSize: 1063, sampleType: "A", results: { Favorable: 39, Unfavorable: 45 } },
  { pollster: "Pew Research", endDate: "2025-02-05", sampleSize: 2557, sampleType: "A", results: { Favorable: 42, Unfavorable: 45 } },
  { pollster: "TIPP", endDate: "2025-01-31", sampleSize: 1478, sampleType: "A", results: { Favorable: 38, Unfavorable: 33 } },
  { pollster: "Economist/YouGov", endDate: "2025-01-28", sampleSize: 1376, sampleType: "RV", results: { Favorable: 47, Unfavorable: 47 } },
  { pollster: "Quinnipiac", endDate: "2025-01-27", sampleSize: 1019, sampleType: "RV", results: { Favorable: 39, Unfavorable: 36 } },
  { pollster: "Morning Consult", endDate: "2025-01-26", sampleSize: 2302, sampleType: "RV", results: { Favorable: 45, Unfavorable: 41 } },
  { pollster: "Gallup", endDate: "2025-01-27", sampleSize: 1001, sampleType: "A", results: { Favorable: 42, Unfavorable: 40 } },
  { pollster: "Atlas Intel", endDate: "2025-01-23", sampleSize: 1882, sampleType: "A", results: { Favorable: 49, Unfavorable: 49 } },
  { pollster: "Economist/YouGov", endDate: "2025-01-21", sampleSize: 1426, sampleType: "RV", results: { Favorable: 43, Unfavorable: 47 } },
  { pollster: "Harvard-Harris", endDate: "2025-01-16", sampleSize: 2650, sampleType: "RV", results: { Favorable: 41, Unfavorable: 35 } },
  { pollster: "Economist/YouGov", endDate: "2025-01-14", sampleSize: 1425, sampleType: "RV", results: { Favorable: 43, Unfavorable: 48 } },
  { pollster: "FOX News", endDate: "2025-01-13", sampleSize: 922, sampleType: "RV", results: { Favorable: 43, Unfavorable: 46 } },
  { pollster: "Wall Street Journal", endDate: "2025-01-14", sampleSize: 1500, sampleType: "RV", results: { Favorable: 44, Unfavorable: 45 } },
  { pollster: "CNN", endDate: "2025-01-12", sampleSize: 0, sampleType: "RV", results: { Favorable: 34, Unfavorable: 41 } },
  { pollster: "USA Today/Suffolk", endDate: "2025-01-11", sampleSize: 1000, sampleType: "RV", results: { Favorable: 39, Unfavorable: 43 } },
  { pollster: "Economist/YouGov", endDate: "2025-01-08", sampleSize: 1522, sampleType: "RV", results: { Favorable: 44, Unfavorable: 47 } },
];
