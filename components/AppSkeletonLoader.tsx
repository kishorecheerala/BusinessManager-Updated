import React from 'react';

const AppSkeletonLoader: React.FC = () => {
    return (
      <div className="sk-app">
        <header className="sk-header">
          <div className="sk-header-items-left">
            <div className="sk-bone"></div><div className="sk-bone"></div>
          </div>
          <div className="sk-header-center">
            <div className="sk-bone"></div><div className="sk-bone"></div>
          </div>
          <div className="sk-header-items-right">
            <div className="sk-bone"></div><div className="sk-bone"></div>
          </div>
        </header>
        <main className="sk-main">
          <div className="sk-grid">
            <div className="sk-card sk-bone"></div>
            <div className="sk-card sk-bone"></div>
            <div className="sk-card sk-bone"></div>
            <div className="sk-card sk-bone"></div>
          </div>
          <div className="sk-list">
            <div className="sk-list-item sk-bone"></div>
            <div className="sk-list-item sk-bone"></div>
          </div>
        </main>
        <nav className="sk-nav">
          <div className="sk-nav-item"><div className="sk-bone"></div><div className="sk-bone"></div></div>
          <div className="sk-nav-item"><div className="sk-bone"></div><div className="sk-bone"></div></div>
          <div className="sk-nav-item"><div className="sk-bone"></div><div className="sk-bone"></div></div>
          <div className="sk-nav-item"><div className="sk-bone"></div><div className="sk-bone"></div></div>
          <div className="sk-nav-item"><div className="sk-bone"></div><div className="sk-bone"></div></div>
        </nav>
      </div>
    );
};

export default AppSkeletonLoader;