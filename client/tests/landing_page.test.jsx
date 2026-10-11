import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../src/context/AppContext.jsx';
import LandingPage from '../src/components/LandingPage.jsx';
import App from '../src/App.jsx';

describe('LandingPage Component & Navigation', () => {
  it('renders landing page with problem statement, 6-layer defense, and CTAs', () => {
    const handleLaunch = vi.fn();
    render(
      <AppProvider>
        <LandingPage onLaunchPlatform={handleLaunch} />
      </AppProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Bankism Intent Firewall/i);
    expect(screen.getByText(/Financial AI Without The/i)).toBeInTheDocument();
    expect(screen.getByText(/The Problem Statement/i)).toBeInTheDocument();
    expect(screen.getByText(/Why Autonomous Financial LLMs Are Exploitable/i)).toBeInTheDocument();
    expect(screen.getByText(/The Dual-Verification Architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/Standard LLM Integration vs. Bankism Firewall/i)).toBeInTheDocument();

    // Verify Launch CTA triggers handler
    const launchButtons = screen.getAllByRole('button', { name: /Launch Platform|Launch Defense Console|Enter Firewall Console/i });
    expect(launchButtons.length).toBeGreaterThan(0);
    fireEvent.click(launchButtons[0]);
    expect(handleLaunch).toHaveBeenCalledTimes(1);
  });

  it('App seamlessly switches between Landing Page and Platform via CTA button and return link', () => {
    render(<App />);

    // Initially on landing page
    expect(screen.getByText(/Financial AI Without The/i)).toBeInTheDocument();

    // Click Launch Platform CTA
    const launchButton = screen.getAllByRole('button', { name: /Launch Platform/i })[0];
    fireEvent.click(launchButton);

    // Now in platform console
    expect(screen.getByText(/Transaction Intent Firewall/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Ledger Balance/i)).toBeInTheDocument();

    // Click back to Overview
    const backButton = screen.getByRole('button', { name: /Problem & Overview/i });
    fireEvent.click(backButton);

    // Back on landing page
    expect(screen.getByText(/The Problem Statement/i)).toBeInTheDocument();
  });
});
