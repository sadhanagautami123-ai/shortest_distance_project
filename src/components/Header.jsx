import React from 'react';

function Header() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">S</div>
        <div>
          <div className="header-title">SAHARA</div>
          <div className="header-subtitle">Disaster Response System</div>
        </div>
      </div>
      <div className="header-meta">
        <span className="header-badge demo">
          <span className="pulse"></span>
          DEMO MODE
        </span>
        <span className="header-team">HMT 5911 · SIH26206</span>
      </div>
    </header>
  );
}

export default Header;
