export default function BrixBuddy({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`buddy-scene ${small ? "small" : ""}`}
      role="img"
      aria-label="Brix, your friendly orange brick buddy"
    >
      <div className="buddy-shadow" />
      <div className="buddy-arm left" />
      <div className="buddy-arm right" />
      <div className="buddy-body">
        <span className="buddy-eye left" />
        <span className="buddy-eye right" />
        <span className="buddy-cheek left" />
        <span className="buddy-cheek right" />
        <span className="buddy-smile" />
      </div>
      <div className="buddy-foot left" />
      <div className="buddy-foot right" />
    </div>
  );
}
