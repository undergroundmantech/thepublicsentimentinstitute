// Poll data for this tracker, kept out of the client page so server code can import it.
import type { Poll } from "@/app/_polling/lib/buildDailyModel";

export const VA_GOV_POLLS: Poll[] = [
  { pollster: "Quantus Insights (R)", endDate: "2025-11-03", sampleSize: 1201, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 53, Other: 1, Undecided: 2 } },
  { pollster: "InsiderAdvantage (R)", endDate: "2025-11-03", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 50, Other: 5, Undecided: 5 } },
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 423, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 54 } },
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 450, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 51, Undecided: 6 } },

  { pollster: "The Trafalgar Group (R)", endDate: "2025-11-02", sampleSize: 1057, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Other: 1, Undecided: 6 } },
  { pollster: "Emerson College", endDate: "2025-10-31", sampleSize: 880, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 55, Other: 0, Undecided: 1 } },
  { pollster: "Echelon Insights", endDate: "2025-10-31", sampleSize: 606, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 55, Undecided: 2 } },
  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1325, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 54, Other: 0, Undecided: 1 } },
  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 53, Undecided: 4 } },
  { pollster: "State Navigate", endDate: "2025-10-28", sampleSize: 614, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 54, Undecided: 5 } },

  { pollster: "InsiderAdvantage (R)/Trafalgar (R)", endDate: "2025-10-28", sampleSize: 800, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 46, Other: 4, Undecided: 8 } },
  { pollster: "Roanoke College", endDate: "2025-10-27", sampleSize: 1041, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 51, Other: 3, Undecided: 5 } },

  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1179, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 57, Other: 2 } },
  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1179, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 55, Other: 0, Undecided: 4 } },

  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 776, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 54, Undecided: 1 } },
  { pollster: "Christopher Newport University", endDate: "2025-10-23", sampleSize: 803, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Undecided: 6 } },
  { pollster: "Suffolk University", endDate: "2025-10-21", sampleSize: 500, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 52, Other: 1, Undecided: 4 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-20", sampleSize: 1302, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 46, "Abigail Spanberger (D)": 51, Other: 1, Undecided: 2 } },
  { pollster: "State Navigate", endDate: "2025-10-20", sampleSize: 694, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 55, Undecided: 3 } },

  { pollster: "Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 54, Other: 2, Undecided: 2 } },
  { pollster: "Washington Post/Schar School", endDate: "2025-10-20", sampleSize: 927, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 53, Other: 5, Undecided: 2 } },

  { pollster: "Kaplan Strategies (R)", endDate: "2025-10-18", sampleSize: 556, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 51, Undecided: 7 } },
  { pollster: "co/efficient (R)", endDate: "2025-10-17", sampleSize: 937, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 49, Other: 1, Undecided: 6 } },
  { pollster: "Clarity Campaign Labs (D)", endDate: "2025-10-17", sampleSize: 958, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 53, Undecided: 4 } },

  { pollster: "The Trafalgar Group (R)/InsiderAdvantage (R)", endDate: "2025-10-15", sampleSize: 1039, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 47, Other: 1, Undecided: 6 } },
  { pollster: "Virginia Commonwealth University", endDate: "2025-10-14", sampleSize: 842, sampleType: "A", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 49, Undecided: 9 } },
  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-10", sampleSize: 1034, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 2, Undecided: 6 } },

  { pollster: "Public Policy Polling (D)", endDate: "2025-10-08", sampleSize: 558, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 52, Undecided: 5 } },
  { pollster: "Cygnal (R)", endDate: "2025-10-07", sampleSize: 600, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 49, Undecided: 6 } },

  { pollster: "Christopher Newport University", endDate: "2025-10-01", sampleSize: 805, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 52, Undecided: 6 } },
  { pollster: "The Trafalgar Group (R)", endDate: "2025-10-01", sampleSize: 1034, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 47, Other: 2, Undecided: 9 } },
  { pollster: "Emerson College", endDate: "2025-09-29", sampleSize: 725, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 42, "Abigail Spanberger (D)": 52, Undecided: 5 } },

  { pollster: "Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 55, Other: 1, Undecided: 2 } },
  { pollster: "Washington Post/Schar School", endDate: "2025-09-29", sampleSize: 1002, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 53, Other: 4, Undecided: 3 } },

  { pollster: "A2 Insights", endDate: "2025-09-28", sampleSize: 771, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 1, Undecided: 6 } },
  { pollster: "co/efficient (R)", endDate: "2025-09-23", sampleSize: 1024, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 49, Other: 1, Undecided: 7 } },

  // source table says (V) for this one; mapping to RV to fit your SampleType union
  { pollster: "OnMessage Inc. (R)", endDate: "2025-09-18", sampleSize: 800, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 50, Undecided: 5 } },

  { pollster: "Christopher Newport University", endDate: "2025-09-14", sampleSize: 808, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 52, Undecided: 8 } },

  // source table has missing N: "– (V)" so sampleSize=0 (this makes its weight 0 in your model)
  { pollster: "Cygnal (R)", endDate: "2025-09-07", sampleSize: 0, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 50, Undecided: 7 } },

  { pollster: "Pulse Decision Science (R)", endDate: "2025-09-05", sampleSize: 512, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 48, Other: 1, Undecided: 8 } },
  { pollster: "SoCal Strategies (R)", endDate: "2025-09-01", sampleSize: 700, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 53, Undecided: 6 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-08-28", sampleSize: 764, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 49, Other: 2, Undecided: 11 } },
  { pollster: "co/efficient (R)", endDate: "2025-08-26", sampleSize: 1025, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 48, Other: 3, Undecided: 7 } },
  { pollster: "Roanoke College", endDate: "2025-08-15", sampleSize: 702, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 46, Other: 1, Undecided: 14 } },

  { pollster: "Wick Insights", endDate: "2025-07-11", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 50, Other: 2, Undecided: 8 } },
  { pollster: "American Directions Research Group/AARP", endDate: "2025-07-08", sampleSize: 1001, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 34, "Abigail Spanberger (D)": 49, Other: 8, Undecided: 9 } },
  { pollster: "Virginia Commonwealth University", endDate: "2025-07-03", sampleSize: 806, sampleType: "A", results: { "Winsome Earle-Sears (R)": 37, "Abigail Spanberger (D)": 49, Other: 2, Undecided: 12 } },
  { pollster: "co/efficient (R)", endDate: "2025-06-10", sampleSize: 1127, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 43, "Abigail Spanberger (D)": 46, Other: 2, Undecided: 9 } },

  { pollster: "Roanoke College", endDate: "2025-05-19", sampleSize: 609, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 26, "Abigail Spanberger (D)": 43, Other: 3, Undecided: 28 } },

  { pollster: "Pantheon Insight/HarrisX", endDate: "2025-05-13", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 48, "Abigail Spanberger (D)": 52 } },
  { pollster: "Pantheon Insight/HarrisX", endDate: "2025-05-13", sampleSize: 1000, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 45, "Abigail Spanberger (D)": 48, Other: 7 } },

  { pollster: "Cygnal (R)", endDate: "2025-02-28", sampleSize: 600, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 46, Undecided: 14 } },
  { pollster: "Roanoke College", endDate: "2025-02-20", sampleSize: 690, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 24, "Abigail Spanberger (D)": 39, Other: 4, Undecided: 33 } },
  { pollster: "co/efficient (R)", endDate: "2025-01-20", sampleSize: 867, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 40, "Abigail Spanberger (D)": 40, Other: 5, Undecided: 15 } },

  { pollster: "Virginia Commonwealth University", endDate: "2025-01-15", sampleSize: 806, sampleType: "A", results: { "Winsome Earle-Sears (R)": 34, "Abigail Spanberger (D)": 44, Other: 5, Undecided: 17 } },
  { pollster: "Christopher Newport University", endDate: "2025-01-13", sampleSize: 806, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 44, Other: 6, Undecided: 12 } },
  { pollster: "Emerson College", endDate: "2025-01-08", sampleSize: 1000, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 41, "Abigail Spanberger (D)": 42, Other: 4, Undecided: 13 } },

  { pollster: "Mason-Dixon Polling & Strategy", endDate: "2024-12-19", sampleSize: 625, sampleType: "RV", results: { "Winsome Earle-Sears (R)": 44, "Abigail Spanberger (D)": 47, Undecided: 9 } },
  { pollster: "Research America Inc.", endDate: "2024-09-09", sampleSize: 1000, sampleType: "A", results: { "Winsome Earle-Sears (R)": 39, "Abigail Spanberger (D)": 39, Other: 10, Undecided: 12 } },

  { pollster: "co/efficient (R)", endDate: "2023-09-10", sampleSize: 834, sampleType: "LV", results: { "Winsome Earle-Sears (R)": 26, "Abigail Spanberger (D)": 27, Undecided: 47 } },
];

export const NJ_GOV_POLLS: Poll[] = [
  // Research Co. (2 samples)
  { pollster: "Research Co.", endDate: "2025-11-03", sampleSize: 429, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 48, Other: 1 } },
  { pollster: "Research Co. (2)", endDate: "2025-11-03", sampleSize: 450, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 46, Other: 1, Undecided: 5 } },

  { pollster: "John Zogby Strategies (D)", endDate: "2025-11-03", sampleSize: 1205, sampleType: "LV", results: { "Mikie Sherrill (D)": 55, "Jack Ciattarelli (R)": 43, Other: 2 } },

  { pollster: "AtlasIntel", endDate: "2025-10-30", sampleSize: 1639, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 49, Undecided: 1 } },

  { pollster: "SoCal Strategies (R)", endDate: "2025-10-29", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },
  { pollster: "Suffolk University", endDate: "2025-10-29", sampleSize: 500, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 42, Other: 2, Undecided: 7 } },

  // Emerson (2 lines, same n)
  { pollster: "Emerson College", endDate: "2025-10-28", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 48, Other: 1, Undecided: 1 } },
  { pollster: "Emerson College (2)", endDate: "2025-10-28", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 48, Other: 1, Undecided: 2 } },

  // Beacon/Shaw (LV + RV)
  { pollster: "Beacon (D)/Shaw (R)", endDate: "2025-10-28", sampleSize: 956, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },
  { pollster: "Beacon (D)/Shaw (R) (RV)", endDate: "2025-10-28", sampleSize: 1107, sampleType: "RV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 43, Undecided: 5 } },

  // Quinnipiac (2 lines)
  { pollster: "Quinnipiac University", endDate: "2025-10-28", sampleSize: 1166, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 43, Other: 2, Undecided: 4 } },
  { pollster: "Quinnipiac University (2)", endDate: "2025-10-28", sampleSize: 1166, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 44, Undecided: 4 } },

  // YouGov (2 lines)
  { pollster: "YouGov", endDate: "2025-10-28", sampleSize: 1153, sampleType: "LV", results: { "Mikie Sherrill (D)": 54, "Jack Ciattarelli (R)": 44, Other: 2 } },
  { pollster: "YouGov (2)", endDate: "2025-10-28", sampleSize: 1153, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 42, Other: 1, Undecided: 6 } },

  { pollster: "Quantus Insights (R)", endDate: "2025-10-27", sampleSize: 1380, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 46, Undecided: 5 } },
  { pollster: "co/efficient (R)", endDate: "2025-10-27", sampleSize: 995, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 47, Other: 1, Undecided: 5 } },
  { pollster: "A2 Insights", endDate: "2025-10-26", sampleSize: 812, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 47, Undecided: 2 } },

  { pollster: "GQR (D)", endDate: "2025-10-20", sampleSize: 1000, sampleType: "LV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 40, Undecided: 8 } },
  { pollster: "Concord Public Opinion Partners (D)", endDate: "2025-10-18", sampleSize: 605, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 40, Undecided: 11 } },
  { pollster: "Rutgers-Eagleton", endDate: "2025-10-17", sampleSize: 795, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 45, Undecided: 5 } },

  // RV/LV combined — stored as RV so it fits your SampleType union
  { pollster: "KAConsulting (R)", endDate: "2025-10-16", sampleSize: 601, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 44, Undecided: 9 } },

  { pollster: "InsiderAdvantage (R)/Trafalgar (R)", endDate: "2025-10-15", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 44, Other: 4, Undecided: 7 } },
  { pollster: "Fairleigh Dickinson University", endDate: "2025-10-15", sampleSize: 814, sampleType: "RV", results: { "Mikie Sherrill (D)": 52, "Jack Ciattarelli (R)": 45, Undecided: 3 } },

  // Beacon/Shaw (Oct 10–14) LV + RV
  { pollster: "Beacon (D)/Shaw (R) (Oct 10–14 LV)", endDate: "2025-10-14", sampleSize: 869, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 45, Undecided: 5 } },
  { pollster: "Beacon (D)/Shaw (R) (Oct 10–14 RV)", endDate: "2025-10-14", sampleSize: 1002, sampleType: "RV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 44, Undecided: 8 } },

  // Quinnipiac (Oct 9–13) 2 lines
  { pollster: "Quinnipiac University (Oct 9–13)", endDate: "2025-10-13", sampleSize: 1327, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 44, Other: 2, Undecided: 4 } },
  { pollster: "Quinnipiac University (Oct 9–13) (2)", endDate: "2025-10-13", sampleSize: 1327, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 44, Undecided: 4 } },

  { pollster: "Rasmussen Reports (R)", endDate: "2025-10-09", sampleSize: 955, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 40, Other: 4, Undecided: 9 } },
  { pollster: "Neighborhood Research (R)", endDate: "2025-10-09", sampleSize: 311, sampleType: "LV", results: { "Mikie Sherrill (D)": 44, "Jack Ciattarelli (R)": 44, Undecided: 12 } },

  { pollster: "Public Policy Polling (D)", endDate: "2025-10-03", sampleSize: 703, sampleType: "RV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 43, Undecided: 8 } },
  { pollster: "John Zogby Strategies (D) (Sep 30–Oct 2)", endDate: "2025-10-02", sampleSize: 912, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 42, Undecided: 8 } },
  { pollster: "Quantus Insights (R) (Sep 29–30)", endDate: "2025-09-30", sampleSize: 900, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 46, Undecided: 6 } },

  // Beacon/Shaw (Sep 25–28) LV + RV
  { pollster: "Beacon (D)/Shaw (R) (Sep 25–28 LV)", endDate: "2025-09-28", sampleSize: 822, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 42, Undecided: 8 } },
  { pollster: "Beacon (D)/Shaw (R) (Sep 25–28 RV)", endDate: "2025-09-28", sampleSize: 1002, sampleType: "RV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 41, Undecided: 11 } },

  { pollster: "Global Strategy Group (D)", endDate: "2025-09-25", sampleSize: 800, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 43, Undecided: 7 } },
  { pollster: "Valcour/Save Jersey (R)", endDate: "2025-09-24", sampleSize: 1274, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 45, Undecided: 7 } },
  { pollster: "Emerson College (Sep 22–23)", endDate: "2025-09-23", sampleSize: 935, sampleType: "LV", results: { "Mikie Sherrill (D)": 43, "Jack Ciattarelli (R)": 43, Other: 3, Undecided: 11 } },
  { pollster: "yes. every kid.", endDate: "2025-09-22", sampleSize: 704, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 41, Undecided: 10 } },

  { pollster: "National Research Inc. (R) (Sep 16–18)", endDate: "2025-09-18", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 46, Undecided: 9 } },

  // Quinnipiac (Sep 11–15) 2 lines
  { pollster: "Quinnipiac University (Sep 11–15)", endDate: "2025-09-15", sampleSize: 1238, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 41, Other: 2, Undecided: 6 } },
  { pollster: "Quinnipiac University (Sep 11–15) (2)", endDate: "2025-09-15", sampleSize: 1238, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 42, Undecided: 7 } },

  { pollster: "National Research Inc. (R) (Sep 8–10)", endDate: "2025-09-10", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 45, Undecided: 8 } },

  // Quantus (Sep 2–4) 2 lines
  { pollster: "Quantus Insights (R) (Sep 2–4)", endDate: "2025-09-04", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 37, Undecided: 16 } },
  { pollster: "Quantus Insights (R) (Sep 2–4) (2)", endDate: "2025-09-04", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 49, "Jack Ciattarelli (R)": 39, Undecided: 12 } },

  // TIPP (3 samples)
  { pollster: "TIPP Insights (R)", endDate: "2025-08-28", sampleSize: 1524, sampleType: "RV", results: { "Mikie Sherrill (D)": 37, "Jack Ciattarelli (R)": 36, Undecided: 27 } },
  { pollster: "TIPP Insights (R) (LV)", endDate: "2025-08-28", sampleSize: 1349, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 39, Other: 2, Undecided: 12 } },
  { pollster: "TIPP Insights (R) (RV 1073)", endDate: "2025-08-28", sampleSize: 1073, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 43, Other: 2, Undecided: 8 } },

  // Rutgers-Eagleton (Jul 31–Aug 11) 2 lines
  { pollster: "Rutgers-Eagleton (Jul 31–Aug 11)", endDate: "2025-08-11", sampleSize: 1650, sampleType: "LV", results: { "Mikie Sherrill (D)": 44, "Jack Ciattarelli (R)": 35, Other: 3, Undecided: 17 } },
  { pollster: "Rutgers-Eagleton (Jul 31–Aug 11) (2)", endDate: "2025-08-11", sampleSize: 1650, sampleType: "LV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 37, Other: 3, Undecided: 12 } },

  { pollster: "A2 Insights (Jul 29–Aug 2)", endDate: "2025-08-02", sampleSize: 629, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 45, Undecided: 4 } },

  { pollster: "StimSight Research", endDate: "2025-07-24", sampleSize: 1108, sampleType: "LV", results: { "Mikie Sherrill (D)": 48, "Jack Ciattarelli (R)": 42, Other: 1, Undecided: 9 } },
  { pollster: "Fairleigh Dickinson University (Jul 17–23)", endDate: "2025-07-23", sampleSize: 806, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 37, Other: 3, Undecided: 15 } },

  // "July 2025" (no exact range in your pasted table)
  { pollster: "National Research Inc. (R) (July 2025)", endDate: "2025-07-15", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 46, "Jack Ciattarelli (R)": 43, Undecided: 11 } },

  // RV/LV combined — stored as RV so it fits your SampleType union
  { pollster: "KAConsulting (R) (Jun 24–27)", endDate: "2025-06-27", sampleSize: 800, sampleType: "RV", results: { "Mikie Sherrill (D)": 47, "Jack Ciattarelli (R)": 42, Undecided: 11 } },

  { pollster: "Cygnal (R)", endDate: "2025-06-20", sampleSize: 500, sampleType: "LV", results: { "Mikie Sherrill (D)": 50, "Jack Ciattarelli (R)": 43, Undecided: 7 } },

  // Rutgers-Eagleton (Jun 13–16) 2 lines
  { pollster: "Rutgers-Eagleton (Jun 13–16)", endDate: "2025-06-16", sampleSize: 621, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 31, Undecided: 18 } },
  { pollster: "Rutgers-Eagleton (Jun 13–16) (2)", endDate: "2025-06-16", sampleSize: 621, sampleType: "LV", results: { "Mikie Sherrill (D)": 56, "Jack Ciattarelli (R)": 35, Undecided: 9 } },

  { pollster: "National Research Inc. (R) (Jun 11–12)", endDate: "2025-06-12", sampleSize: 600, sampleType: "LV", results: { "Mikie Sherrill (D)": 45, "Jack Ciattarelli (R)": 42, Undecided: 12 } },

  { pollster: "SurveyUSA (D)", endDate: "2025-05-30", sampleSize: 576, sampleType: "LV", results: { "Mikie Sherrill (D)": 51, "Jack Ciattarelli (R)": 38, Undecided: 12 } },
];
