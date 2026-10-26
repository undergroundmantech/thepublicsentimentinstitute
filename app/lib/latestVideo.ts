// The newest On Point video the site promotes in the pop up (VideoPromo). To promote the next one, change this object
// and drop its thumbnail in public/video/; every visitor sees the new video once, whatever they did with the last one.
// Its id is also a feature flag (flagValues.ts, "video-promo"), so page views and events can be split by the video live.
export const LATEST_VIDEO = {
  id: "sy6gfGAfSMI",
  title: "This is what real early voting analysis looks like",
  // the hook on the card, read off the thumbnail
  hook: "North Carolina's early vote is 16.9 points bluer than 2024, Texas 11.8 and Arizona 7.6.",
  pointy: "New video! The early vote, state by state.",
  thumb: "/video/early-vote-analysis-sy6gfGAfSMI.webp",
  published: "2026-10-26",
  // pages where the card comes up sooner, because the video is about what is on them
  hot: [/^\/maps\/early-vote/, /^\/earlyvote/, /^\/forecast/],
} as const;

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const videoEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
