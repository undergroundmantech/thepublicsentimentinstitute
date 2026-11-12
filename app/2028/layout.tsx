import type { ReactNode } from "react";
import Nav28 from "./Nav28";
import "./x28.css";

// The 2028 model has its own home: the overview map, both primaries, the general election and the ticket builder.
export default function Layout28({ children }: { children: ReactNode }) {
  return (
    <div className="opp x28 fx-dark">
      <Nav28 />
      {children}
    </div>
  );
}
