/* Static product visuals for the landing page. */

export function CardStack() {
  return (
    <div className="card-stack" aria-hidden="true">
      <div className="virtual-card card-stack__front">
        <div className="virtual-card__top">
          <strong>brix.</strong>
          <span className="badge">Single use</span>
        </div>
        <span className="chip-icon" />
        <small>Spending limit</small>
        <p className="card-stack__amount">$10.00</p>
        <div className="virtual-card__bottom">
          <span>Notion trial</span>
          <span>•••• 4242</span>
        </div>
      </div>
    </div>
  );
}
