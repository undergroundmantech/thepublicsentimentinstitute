// Re-mounted on every navigation, so each page arrives with the same short lift and fade (motion.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="sx-route">{children}</div>;
}
