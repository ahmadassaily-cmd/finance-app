export function FinanceMark({ size, rounded = true }: { size: number; rounded?: boolean }) {
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const barW = Math.round(size * 0.13);
  const gap = Math.round(size * 0.09);
  const barBaseH = Math.round(size * 0.24);
  const barMidH = Math.round(size * 0.4);
  const barTopH = Math.round(size * 0.58);
  const barRadius = Math.round(barW * 0.35);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#6366F1",
        borderRadius: radius,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap }}>
        <div style={{ width: barW, height: barBaseH, background: "#F2F3FF", borderRadius: barRadius }} />
        <div style={{ width: barW, height: barMidH, background: "#F2F3FF", borderRadius: barRadius }} />
        <div style={{ width: barW, height: barTopH, background: "#2DD4A0", borderRadius: barRadius }} />
      </div>
    </div>
  );
}
