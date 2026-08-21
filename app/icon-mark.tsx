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
        background: "#0F1830",
        borderRadius: radius,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap }}>
        <div style={{ width: barW, height: barBaseH, background: "#8792AD", borderRadius: barRadius }} />
        <div style={{ width: barW, height: barMidH, background: "#8792AD", borderRadius: barRadius }} />
        <div style={{ width: barW, height: barTopH, background: "#D4AF6A", borderRadius: barRadius }} />
      </div>
    </div>
  );
}
