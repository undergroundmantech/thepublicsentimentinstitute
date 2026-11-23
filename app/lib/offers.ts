// Every outside link and price for the community, the workshops and consulting, in one place: change a link here and
// every page that uses it follows.
export const SOCIAL = {
  youtube: "https://www.youtube.com/@onpointpoliticsofficial",
  youtubeSub: "https://www.youtube.com/@onpointpoliticsofficial?sub_confirmation=1",
  x: "https://x.com/onpointpolitics",
  discord: "https://discord.gg/EKP4HaSH3",
  substack: "https://onpointpolitics.substack.com",
};
/** the Weighting Room on Locals, where memberships are paid */
export const LOCALS = "https://theweightingroom.locals.com";
/** Calendly, the paid 60 minute strategy call; until it is set, the button goes to the contact page */
export const CALENDLY = "";
/** Stripe Payment Links for the workshops; until they are set, the buttons take a waitlist signup */
export const PAY_CLASS = "";
export const PAY_REPLAY = "";
export const PAY_COURSE = "";

/** the Weighting Room membership tiers, paid on Locals */
export const TIERS = [
  { name: "Member", price: "$50", per: "a month", best: true, perks: ["Every poll's full crosstabs the day it is released", "The members' feed of model notes and early looks at toplines and county maps", "A monthly live Q and A with the desk, and live chats", "The replay library of every workshop", "The members' Discord channels"] },
];
export const FOUNDING = { seats: 100, note: "The first 100 members keep their price for as long as they stay." };

export const WORKSHOPS = [
  { id: "polls-101", name: "How Polls Actually Work", format: "One live class, 90 minutes, on Zoom, replay included", price: 59, early: 49, when: "Date to be announced", pay: PAY_CLASS,
    points: ["Why 1,000 people can describe 150 million voters, and when they can't", "How weighting fixes a lopsided sample, live in a spreadsheet", "How likely voter screens decide who counts", "How to grade any poll in two minutes"] },
  { id: "forecast-course", name: "Build a County Forecast Model", format: "Three live sessions of 2 hours, files and replays", price: 249, early: 199, when: "Before the 2027 governor primaries", pay: PAY_COURSE,
    points: ["Every county's lean and trend from 2016, 2020 and 2024", "Gallup party ID and a polling average moved onto every county", "1,000 simulations, a win probability and a rated county map", "You leave with a working forecast for one state"] },
];

export const CONSULTING = [
  { name: "Strategy call", what: "60 minutes on your race, your polling or your message, with a one page follow up note", price: "$200", note: "Credited toward any project within 30 days" },
  { name: "Poll readout", what: "A walk through of a poll you already have and a written memo on what it really says", price: "$500", note: "3 business days" },
  { name: "Custom forecast", what: "A county by county forecast of your district or state, with a report, a map and a briefing", price: "$2,500 to $5,000", note: "2 to 3 weeks" },
  { name: "Custom poll", what: "Questionnaire, fieldwork, weighting, crosstabs and a briefing from On Point Polling", price: "Per rate card", note: "2 to 4 weeks" },
  { name: "Retainer", what: "A monthly tracker, forecast updates for your races and a standing call", price: "From $3,000 a month", note: "Through Election Day" },
];

/** alert topics a reader can pick */
export const TOPICS = [
  { k: "videos", label: "New videos" },
  { k: "polls", label: "New On Point polls" },
  { k: "majority", label: "Majority tracker changes" },
  { k: "forecast", label: "2028 forecast updates" },
  { k: "workshops", label: "Workshop dates" },
] as const;
export type Topic = (typeof TOPICS)[number]["k"];

/** the consent shown beside the mobile number on every alerts signup; the signup stores this exact text with the number */
export const SMS_CONSENT = "By checking this box, you agree to receive recurring automated text messages from The Public Sentiment Institute (TPSI), doing business as On Point Polling, about new On Point Politics videos, polls and forecast updates at the number provided. Consent is not a condition of purchase. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.";
/** the consent on the SMS program page, word for word as registered for the 10DLC campaign */
export const SMS_CONSENT_PAGE = "By submitting this form and signing up for texts, you consent to receive text messages (e.g., political polling and market research/surveys) from The Public Sentiment Institute (TPSI), doing business as On Point Polling, at the number provided, including messages sent by auto-dialer. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP or clicking the unsubscribe link (where available). Reply HELP for help. Your mobile number and consent are never shared with third parties or affiliates for marketing.";
