"use client";
// Stream mode: read a Twitch channel's chat with no login, so chat can vote on cards, feed the chaos meter and start a
// hype train. Twitch lets anyone read public chat anonymously over its IRC WebSocket with a justinfan nickname.
import { useEffect, useRef, useState } from "react";

export type ChatMsg = { user: string; text: string; color?: string; t: number };
export type StreamCfg = { on: boolean; channel: string; voteSec: number; crisisSec: number; chatBox: boolean; auto?: boolean };
const KEY = "opp_play_stream";
export const DEF_CFG: StreamCfg = { on: false, channel: "", voteSec: 30, crisisSec: 20, chatBox: true };
export function loadCfg(): StreamCfg { try { return { ...DEF_CFG, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEF_CFG; } }
export function saveCfg(c: StreamCfg) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage blocked */ } }

export type ChatStatus = "off" | "connecting" | "live" | "error";

/** Connect to a channel's chat. Every message goes to the listener; the hook keeps the status and the last few lines. */
export function useTwitch(channel: string, enabled: boolean, onMsg: (m: ChatMsg) => void) {
  const [status, setStatus] = useState<ChatStatus>("off");
  const [recent, setRecent] = useState<ChatMsg[]>([]);
  const cb = useRef(onMsg); useEffect(() => { cb.current = onMsg; }, [onMsg]);
  useEffect(() => {
    const ch = channel.trim().toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_]/g, "");
    if (!enabled || !ch) { setStatus("off"); return; }
    let ws: WebSocket | null = null, dead = false, retry = 0, timer = 0;
    const open = () => {
      if (dead) return; setStatus("connecting");
      try { ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443"); } catch { setStatus("error"); return; }
      ws.onopen = () => {
        ws!.send("CAP REQ :twitch.tv/tags");
        ws!.send("PASS SCHMOOPIIE");
        ws!.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
        ws!.send(`JOIN #${ch}`);
      };
      ws.onmessage = (ev) => {
        for (const line of String(ev.data).split("\r\n")) {
          if (!line) continue;
          if (line.startsWith("PING")) { ws!.send("PONG :tmi.twitch.tv"); continue; }
          if (/ 366 /.test(line) || / JOIN #/.test(line)) { setStatus("live"); retry = 0; }
          const m = /^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(line);
          if (!m) continue;
          const tags = Object.fromEntries((m[1] ?? "").split(";").map((kv) => kv.split("=")));
          const msg: ChatMsg = { user: tags["display-name"] || m[2], text: m[3], color: tags.color || undefined, t: Date.now() };
          setStatus("live");
          setRecent((r) => [...r.slice(-24), msg]);
          cb.current(msg);
        }
      };
      ws.onerror = () => setStatus("error");
      ws.onclose = () => { if (dead) return; setStatus("connecting"); retry++; timer = window.setTimeout(open, Math.min(15000, 1000 * 2 ** retry)); };
    };
    open();
    return () => { dead = true; clearTimeout(timer); try { ws?.close(); } catch { /* closed */ } };
  }, [channel, enabled]);
  return { status, recent };
}

/** Read a vote out of a chat line: "1", "!1", "!vote 2", "#3", "option 4". */
export function voteOf(text: string, n: number): number | null {
  const m = /^\s*(?:!vote\s*|!|#|option\s*)?([1-9])\b/i.exec(text);
  if (!m) return null; const k = Number(m[1]) - 1;
  return k >= 0 && k < n ? k : null;
}
export const isChaos = (t: string) => /^\s*!chaos\b/i.test(t);
export const isHype = (t: string) => /^\s*!hype\b/i.test(t) || /^\s*(pog|poggers|letsgo|lets go|hype)\b/i.test(t);
