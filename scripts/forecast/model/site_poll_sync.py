"""Polls the site's poll files carry and the forecast's own poll files did not, synced Sept 28, 2026.

The forecast's polling level is now the LOWESS Election Day polling average, the same trend the
Polling Averages page draws. Both must run on the same polls, and 81 polls, most of them from 2025,
existed only on the site. They are merged in by senate_mode._add_extra after the race's own file and
EXTRA_POLLS, skipping any poll already present under the same source and dates."""
SITE_SYNC = {
    "ARG": [
        {'source': 'J.L. Partners (R)', 'dates': 'August 14-18, 2026', 'end': '2026-08-18', 'n': 803, 'pop': 'LV', 'D': 40.0, 'R': 45.0, 'O': 0.0, 'U': 15.0},
    ],
    "AZG": [
        {'source': 'Kreate Strategies (R)', 'dates': 'February 5-7, 2025', 'end': '2025-02-07', 'n': 924, 'pop': 'LV', 'D': 43.0, 'R': 44.0, 'O': 0.0, 'U': 13.0},
        {'source': 'Noble Predictive Insights', 'dates': 'February 11-13, 2025', 'end': '2025-02-13', 'n': 1006, 'pop': 'RV', 'D': 40.0, 'R': 38.0, 'O': 5.0, 'U': 17.0},
        {'source': 'Pulse Decision Science (R)', 'dates': 'April 6-9, 2025', 'end': '2025-04-09', 'n': 501, 'pop': 'LV', 'D': 46.0, 'R': 42.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Noble Predictive Insights', 'dates': 'May 12-16, 2025', 'end': '2025-05-16', 'n': 1026, 'pop': 'RV', 'D': 40.0, 'R': 38.0, 'O': 5.0, 'U': 17.0},
        {'source': 'Noble Predictive Insights', 'dates': 'August 11-18, 2025', 'end': '2025-08-18', 'n': 948, 'pop': 'RV', 'D': 39.0, 'R': 37.0, 'O': 4.0, 'U': 20.0},
        {'source': 'Emerson College', 'dates': 'November 8-10, 2025', 'end': '2025-11-10', 'n': 850, 'pop': 'RV', 'D': 44.0, 'R': 43.0, 'O': 0.0, 'U': 13.0},
        {'source': 'NXTGenP (R)', 'dates': 'December 15-17, 2025', 'end': '2025-12-17', 'n': 2725, 'pop': 'LV', 'D': 51.0, 'R': 32.0, 'O': 7.0, 'U': 9.0},
    ],
    "FLG": [
        {'source': 'Victory Insights', 'dates': 'June 7-10, 2025', 'end': '2025-06-10', 'n': 600, 'pop': 'LV', 'D': 31.0, 'R': 37.0, 'O': 0.0, 'U': 32.0},
        {'source': 'AIF Center', 'dates': 'August 25-27, 2025', 'end': '2025-08-27', 'n': 800, 'pop': 'LV', 'D': 41.0, 'R': 49.0, 'O': 0.0, 'U': 11.0},
        {'source': 'Bendixen & Amandi International', 'dates': 'September 7-9, 2025', 'end': '2025-09-09', 'n': 631, 'pop': 'LV', 'D': 41.0, 'R': 40.0, 'O': 0.0, 'U': 19.0},
        {'source': 'Targoz Market Research', 'dates': 'September 16-18, 2025', 'end': '2025-09-18', 'n': 1118, 'pop': 'RV', 'D': 32.0, 'R': 36.0, 'O': 4.0, 'U': 28.0},
        {'source': 'University of North Florida', 'dates': 'October 15-25, 2025', 'end': '2025-10-25', 'n': 728, 'pop': 'LV', 'D': 34.0, 'R': 45.0, 'O': 3.0, 'U': 18.0},
    ],
    "GA": [
        {'source': 'WPA Intelligence (R)', 'dates': 'January 15, 2025', 'end': '2025-01-15', 'n': 500, 'pop': 'RV', 'D': 44.0, 'R': 34.0, 'O': 0.0, 'U': 22.0},
        {'source': 'Trafalgar Group (R)', 'dates': 'April 27, 2025', 'end': '2025-04-27', 'n': 1426, 'pop': 'RV', 'D': 48.0, 'R': 43.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Cygnal (R)', 'dates': 'May 17, 2025', 'end': '2025-05-17', 'n': 800, 'pop': 'RV', 'D': 46.0, 'R': 43.0, 'O': 0.0, 'U': 11.0},
        {'source': 'TIPP Insights', 'dates': 'August 1, 2025', 'end': '2025-08-01', 'n': 2956, 'pop': 'RV', 'D': 45.0, 'R': 44.0, 'O': 0.0, 'U': 11.0},
        {'source': 'Quantus Insights', 'dates': 'September 12, 2025', 'end': '2025-09-12', 'n': 624, 'pop': 'RV', 'D': 38.0, 'R': 38.0, 'O': 0.0, 'U': 24.0},
    ],
    "IAG": [
        {'source': 'NPR/Marist', 'dates': 'September 17-20, 2026', 'end': '2026-09-20', 'n': 1050, 'pop': 'RV', 'D': 54.0, 'R': 42.0, 'O': 0.0, 'U': 4.0},
    ],
    "IDG": [
        {'source': 'Advanced Targeting Research', 'dates': 'September 13-16, 2026', 'end': '2026-09-16', 'n': 700, 'pop': 'RV', 'D': 27.0, 'R': 37.0, 'O': 0.0, 'U': 36.0},
    ],
    "MI": [
        {'source': 'Glengariff Group', 'dates': 'May 8, 2025', 'end': '2025-05-08', 'n': 600, 'pop': 'RV', 'D': 41.0, 'R': 47.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Rosetta Stone Communications (R)', 'dates': 'October 25, 2025', 'end': '2025-10-25', 'n': 637, 'pop': 'RV', 'D': 31.0, 'R': 45.0, 'O': 0.0, 'U': 24.0},
        {'source': 'Mitchell Research & Communications', 'dates': 'November 21, 2025', 'end': '2025-11-21', 'n': 616, 'pop': 'RV', 'D': 38.0, 'R': 41.0, 'O': 0.0, 'U': 21.0},
        {'source': 'Glengariff Group', 'dates': 'January 6, 2026', 'end': '2026-01-06', 'n': 600, 'pop': 'RV', 'D': 47.0, 'R': 43.0, 'O': 0.0, 'U': 10.0},
        {'source': 'Emerson College', 'dates': 'January 25, 2026', 'end': '2026-01-25', 'n': 1000, 'pop': 'RV', 'D': 43.0, 'R': 43.0, 'O': 0.0, 'U': 14.0},
    ],
    "MIG": [
        {'source': 'Target Insyght', 'dates': 'February 3-8, 2025', 'end': '2025-02-08', 'n': 600, 'pop': 'RV', 'D': 42.0, 'R': 30.0, 'O': 0.0, 'U': 7.0},
        {'source': 'Mitchell Research', 'dates': 'March 13, 2025', 'end': '2025-03-13', 'n': 688, 'pop': 'LV', 'D': 37.0, 'R': 34.0, 'O': 0.0, 'U': 13.0},
        {'source': 'Glengariff Group', 'dates': 'May 5-8, 2025', 'end': '2025-05-08', 'n': 600, 'pop': 'RV', 'D': 35.0, 'R': 34.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Schoen Cooperman Research', 'dates': 'October 9-14, 2025', 'end': '2025-10-14', 'n': 600, 'pop': 'LV', 'D': 30.0, 'R': 29.0, 'O': 0.0, 'U': 15.0},
        {'source': 'Rosetta Stone Communications', 'dates': 'October 23-25, 2025', 'end': '2025-10-25', 'n': 637, 'pop': 'LV', 'D': 34.0, 'R': 39.0, 'O': 0.0, 'U': 9.0},
        {'source': 'EPIC-MRA', 'dates': 'November 6-11, 2025', 'end': '2025-11-11', 'n': 600, 'pop': 'RV', 'D': 33.0, 'R': 34.0, 'O': 0.0, 'U': 13.0},
        {'source': 'Mitchell Research', 'dates': 'November 18-21, 2025', 'end': '2025-11-21', 'n': 616, 'pop': 'LV', 'D': 31.0, 'R': 37.0, 'O': 0.0, 'U': 14.0},
        {'source': 'Glengariff Group', 'dates': 'January 2-6, 2026', 'end': '2026-01-06', 'n': 600, 'pop': 'LV', 'D': 32.0, 'R': 34.0, 'O': 0.0, 'U': 8.0},
    ],
    "NC": [
        {'source': 'Emerson College', 'dates': 'July 30, 2025', 'end': '2025-07-30', 'n': 1000, 'pop': 'RV', 'D': 47.0, 'R': 41.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Victory Insights (R)', 'dates': 'July 30, 2025', 'end': '2025-07-30', 'n': 600, 'pop': 'RV', 'D': 43.0, 'R': 40.0, 'O': 0.0, 'U': 17.0},
        {'source': 'Harper Polling (R)', 'dates': 'August 12, 2025', 'end': '2025-08-12', 'n': 600, 'pop': 'RV', 'D': 47.0, 'R': 39.0, 'O': 0.0, 'U': 14.0},
        {'source': 'Change Research (D)', 'dates': 'September 8, 2025', 'end': '2025-09-08', 'n': 855, 'pop': 'RV', 'D': 48.0, 'R': 41.0, 'O': 0.0, 'U': 11.0},
        {'source': 'Harper Polling (R)', 'dates': 'September 15, 2025', 'end': '2025-09-15', 'n': 600, 'pop': 'RV', 'D': 46.0, 'R': 42.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Harper Polling (R)', 'dates': 'November 10, 2025', 'end': '2025-11-10', 'n': 600, 'pop': 'RV', 'D': 47.0, 'R': 39.0, 'O': 0.0, 'U': 14.0},
        {'source': 'Change Research (D)', 'dates': 'January 7, 2026', 'end': '2026-01-07', 'n': 1105, 'pop': 'RV', 'D': 47.0, 'R': 42.0, 'O': 0.0, 'U': 11.0},
        {'source': 'TIPP Insights (R)', 'dates': 'January 15, 2026', 'end': '2026-01-15', 'n': 1512, 'pop': 'RV', 'D': 48.0, 'R': 24.0, 'O': 0.0, 'U': 28.0},
    ],
    "NE": [
        {'source': 'Change Research', 'dates': 'March 28 - April 1, 2025', 'end': '2025-04-01', 'n': 524, 'pop': 'LV', 'D': 45.0, 'R': 46.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Lake Research Partners', 'dates': 'July 23-29, 2025', 'end': '2025-07-29', 'n': 900, 'pop': 'LV', 'D': 47.0, 'R': 46.0, 'O': 0.0, 'U': 7.0},
        {'source': 'Lake Research Partners', 'dates': 'December 11-17, 2025', 'end': '2025-12-17', 'n': 900, 'pop': 'LV', 'D': 47.0, 'R': 48.0, 'O': 0.0, 'U': 5.0},
    ],
    "NH": [
        {'source': '1892 Polling', 'dates': 'September 2-4, 2025', 'end': '2025-09-04', 'n': 500, 'pop': 'LV', 'D': 45.0, 'R': 43.0, 'O': 0.0, 'U': 12.0},
        {'source': 'co/efficient', 'dates': 'September 10-12, 2025', 'end': '2025-09-12', 'n': 904, 'pop': 'LV', 'D': 46.0, 'R': 43.0, 'O': 0.0, 'U': 11.0},
        {'source': 'University of New Hampshire', 'dates': 'September 17-23, 2025', 'end': '2025-09-23', 'n': 1235, 'pop': 'LV', 'D': 49.0, 'R': 43.0, 'O': 1.0, 'U': 7.0},
        {'source': 'co/efficient', 'dates': 'October 9-13, 2025', 'end': '2025-10-13', 'n': 1034, 'pop': 'LV', 'D': 45.0, 'R': 42.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Saint Anselm College', 'dates': 'November 18-19, 2025', 'end': '2025-11-19', 'n': 2212, 'pop': 'RV', 'D': 44.0, 'R': 41.0, 'O': 0.0, 'U': 16.0},
        {'source': 'Guidant Polling and Strategy', 'dates': 'December 9-11, 2025', 'end': '2025-12-11', 'n': 600, 'pop': 'LV', 'D': 47.0, 'R': 44.0, 'O': 0.0, 'U': 9.0},
        {'source': 'NHJournal/Praecones Analytica', 'dates': 'December 26-28, 2025', 'end': '2025-12-28', 'n': 603, 'pop': 'RV', 'D': 42.0, 'R': 36.0, 'O': 0.0, 'U': 22.0},
        {'source': 'University of New Hampshire', 'dates': 'January 15-19, 2026', 'end': '2026-01-19', 'n': 2053, 'pop': 'LV', 'D': 50.0, 'R': 45.0, 'O': 1.0, 'U': 5.0},
    ],
    "NVG": [
        {'source': 'Vote TXT', 'dates': 'May 15-19, 2023', 'end': '2023-05-19', 'n': 412, 'pop': 'RV', 'D': 30.0, 'R': 51.0, 'O': 7.0, 'U': 12.0},
        {'source': 'Noble Predictive Insights', 'dates': 'October 7-13, 2025', 'end': '2025-10-13', 'n': 766, 'pop': 'RV', 'D': 37.0, 'R': 40.0, 'O': 0.0, 'U': 23.0},
        {'source': 'Emerson College', 'dates': 'November 16-18, 2025', 'end': '2025-11-18', 'n': 800, 'pop': 'RV', 'D': 41.0, 'R': 41.0, 'O': 0.0, 'U': 18.0},
    ],
    "NYG": [
        {'source': 'GrayHouse', 'dates': 'April 22-24, 2025', 'end': '2025-04-24', 'n': 600, 'pop': 'RV', 'D': 44.0, 'R': 36.0, 'O': 0.0, 'U': 20.0},
        {'source': 'Siena College', 'dates': 'June 23-26, 2025', 'end': '2025-06-26', 'n': 800, 'pop': 'RV', 'D': 44.0, 'R': 19.0, 'O': 0.0, 'U': 37.0},
        {'source': 'J.L. Partners', 'dates': 'November 9-10, 2025', 'end': '2025-11-10', 'n': 500, 'pop': 'LV', 'D': 47.0, 'R': 36.0, 'O': 0.0, 'U': 17.0},
        {'source': 'Siena College', 'dates': 'December 8-12, 2025', 'end': '2025-12-12', 'n': 801, 'pop': 'RV', 'D': 50.0, 'R': 25.0, 'O': 4.0, 'U': 21.0},
        {'source': 'John Zogby Strategies', 'dates': 'January 6-8, 2026', 'end': '2026-01-08', 'n': 844, 'pop': 'LV', 'D': 53.0, 'R': 39.0, 'O': 0.0, 'U': 8.0},
        {'source': 'Siena College', 'dates': 'January 26-28, 2026', 'end': '2026-01-28', 'n': 802, 'pop': 'RV', 'D': 54.0, 'R': 28.0, 'O': 1.0, 'U': 17.0},
        {'source': 'Siena College', 'dates': 'September 11-17, 2026', 'end': '2026-09-17', 'n': 1144, 'pop': 'LV', 'D': 50.0, 'R': 41.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Quinnipiac University', 'dates': 'September 17-20, 2026', 'end': '2026-09-20', 'n': 1026, 'pop': 'LV', 'D': 58.0, 'R': 39.0, 'O': 0.0, 'U': 3.0},
    ],
    "OH": [
        {'source': 'Bowling Green State University/YouGov', 'dates': 'February 14-21, 2025', 'end': '2025-02-21', 'n': 800, 'pop': 'RV', 'D': 41.0, 'R': 47.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Bowling Green State University/YouGov', 'dates': 'April 18-24, 2025', 'end': '2025-04-24', 'n': 800, 'pop': 'RV', 'D': 46.0, 'R': 49.0, 'O': 5.0, 'U': 0.0},
        {'source': 'Emerson College', 'dates': 'August 18-19, 2025', 'end': '2025-08-19', 'n': 1000, 'pop': 'RV', 'D': 44.0, 'R': 50.0, 'O': 0.0, 'U': 7.0},
        {'source': 'Hart Research', 'dates': 'September 19-22, 2025', 'end': '2025-09-22', 'n': 800, 'pop': 'LV', 'D': 48.0, 'R': 45.0, 'O': 0.0, 'U': 7.0},
        {'source': 'Bowling Green State University/YouGov', 'dates': 'October 2-14, 2025', 'end': '2025-10-14', 'n': 800, 'pop': 'RV', 'D': 49.0, 'R': 48.0, 'O': 3.0, 'U': 0.0},
        {'source': 'Emerson College', 'dates': 'December 6-8, 2025', 'end': '2025-12-08', 'n': 850, 'pop': 'RV', 'D': 46.0, 'R': 49.0, 'O': 0.0, 'U': 5.0},
    ],
    "OHG": [
        {'source': 'Public Policy Polling', 'dates': 'February 19-20, 2025', 'end': '2025-02-20', 'n': 642, 'pop': 'RV', 'D': 45.0, 'R': 44.0, 'O': 0.0, 'U': 11.0},
        {'source': 'Bowling Green State University/YouGov', 'dates': 'April 18-24, 2025', 'end': '2025-04-24', 'n': 800, 'pop': 'RV', 'D': 45.0, 'R': 50.0, 'O': 5.0, 'U': 0.0},
        {'source': 'Impact Research', 'dates': 'July 24-28, 2025', 'end': '2025-07-28', 'n': 800, 'pop': 'LV', 'D': 46.0, 'R': 47.0, 'O': 0.0, 'U': 7.0},
        {'source': 'Emerson College', 'dates': 'August 18-19, 2025', 'end': '2025-08-19', 'n': 1000, 'pop': 'RV', 'D': 39.0, 'R': 49.0, 'O': 0.0, 'U': 12.0},
        {'source': 'Hart Research', 'dates': 'September 19-22, 2025', 'end': '2025-09-22', 'n': 800, 'pop': 'LV', 'D': 46.0, 'R': 45.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Bowling Green State University/YouGov', 'dates': 'October 2-14, 2025', 'end': '2025-10-14', 'n': 800, 'pop': 'RV', 'D': 47.0, 'R': 50.0, 'O': 3.0, 'U': 0.0},
        {'source': 'Emerson College', 'dates': 'December 6-8, 2025', 'end': '2025-12-08', 'n': 850, 'pop': 'RV', 'D': 46.0, 'R': 45.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Data Targeting', 'dates': 'December 3-8, 2025', 'end': '2025-12-08', 'n': 603, 'pop': 'LV', 'D': 43.0, 'R': 45.0, 'O': 0.0, 'U': 12.0},
    ],
    "PAG": [
        {'source': 'Susquehanna Polling & Research', 'dates': 'September 22-28, 2025', 'end': '2025-09-28', 'n': 700, 'pop': 'LV', 'D': 54.0, 'R': 36.0, 'O': 0.0, 'U': 9.0},
        {'source': 'Quinnipiac University', 'dates': 'September 25-29, 2025', 'end': '2025-09-29', 'n': 1579, 'pop': 'RV', 'D': 55.0, 'R': 39.0, 'O': 1.0, 'U': 5.0},
        {'source': 'The New York Times/The Philadelphia Inquirer/Siena', 'dates': 'September 15-21, 2026', 'end': '2026-09-21', 'n': 615, 'pop': 'LV', 'D': 58.0, 'R': 38.0, 'O': 0.0, 'U': 4.0},
    ],
    "TNG": [
        {'source': 'TargetSmart (D)', 'dates': 'September 12, 2026', 'end': '2026-09-12', 'n': 600, 'pop': 'LV', 'D': 36.0, 'R': 45.0, 'O': 0.0, 'U': 19.0},
    ],
}
