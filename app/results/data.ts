/**
 * Texas Runoff Race Data — sourced from the Civic API as of May 2026.
 * Replace this typed constant with a live Civic API fetch when available.
 */

export interface Candidate {
  name: string;
  incumbent: boolean;
  /** Percentage (0–100), or null when data is not available */
  marchPrimary: number | null;
  /** Optional note to display when marchPrimary is null */
  marchPrimaryNote?: string;
  /** Percentage (0–100), or null when data is not available */
  recentPolling: number | null;
}

export interface RunoffRace {
  id: string;
  name: string;
  party: "Republican" | "Democratic";
  candidates: [Candidate, Candidate];
}

export const races: RunoffRace[] = [
  {
    id: "us-senate-rep",
    name: "U.S. Senate",
    party: "Republican",
    candidates: [
      {
        name: "John Cornyn",
        incumbent: true,
        marchPrimary: 42.0,
        recentPolling: 44.0,
      },
      {
        name: "Ken Paxton",
        incumbent: false,
        marchPrimary: 40.5,
        recentPolling: 49.0,
      },
    ],
  },
  {
    id: "tx-ag-rep",
    name: "Texas Attorney General",
    party: "Republican",
    candidates: [
      {
        name: "Mayes Middleton",
        incumbent: false,
        marchPrimary: 39.2,
        recentPolling: null,
      },
      {
        name: "Chip Roy",
        incumbent: false,
        marchPrimary: 31.7,
        recentPolling: null,
      },
    ],
  },
  {
    id: "tx-ag-dem",
    name: "Texas Attorney General",
    party: "Democratic",
    candidates: [
      {
        name: "Nathan Johnson",
        incumbent: false,
        marchPrimary: 48.1,
        recentPolling: null,
      },
      {
        name: "Joe Jaworski",
        incumbent: false,
        marchPrimary: 26.4,
        recentPolling: null,
      },
    ],
  },
  {
    id: "tx-rrc-rep",
    name: "Texas Railroad Commissioner",
    party: "Republican",
    candidates: [
      {
        name: "Jim Wright",
        incumbent: true,
        marchPrimary: null,
        marchPrimaryNote: "Advanced from multi-candidate field",
        recentPolling: null,
      },
      {
        name: "Bo French",
        incumbent: false,
        marchPrimary: null,
        marchPrimaryNote: "Advanced from multi-candidate field",
        recentPolling: null,
      },
    ],
  },
  {
    id: "us-house-18-dem",
    name: "U.S. House District 18",
    party: "Democratic",
    candidates: [
      {
        name: "Christian Menefee",
        incumbent: false,
        marchPrimary: 46.0,
        recentPolling: 50.0,
      },
      {
        name: "Al Green",
        incumbent: false,
        marchPrimary: 44.0,
        recentPolling: 43.0,
      },
    ],
  },
];
