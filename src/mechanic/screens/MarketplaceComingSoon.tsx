export function MarketplaceComingSoon() {
  return (
    <section className="marketplace-soon-page">
      <div className="marketplace-soon-card">
        <div className="marketplace-emoji-row" aria-hidden="true">
          <span>🛠️</span>
          <span>🚜</span>
          <span>🛒</span>
        </div>
        <p className="eyebrow">Marketplace</p>
        <h1>Feature coming soon</h1>
        <p>Buy or sell</p>
        <div className="marketplace-preview-chips" aria-label="Marketplace preview items">
          <span>🔧 Tools</span>
          <span>⚙️ Spare parts</span>
          <span>🧰 Service kits</span>
        </div>
      </div>
    </section>
  );
}
