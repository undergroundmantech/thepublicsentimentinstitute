import MonitorSplash from "./MonitorSplash";
import "./monitor.css";

// Shown at once when the monitor is opened from another page, while its code arrives. The monitor then keeps the same
// screen up until it is ready, so the two read as one.
export default function Loading() {
  return <div className="mon mon-loading"><MonitorSplash /></div>;
}
