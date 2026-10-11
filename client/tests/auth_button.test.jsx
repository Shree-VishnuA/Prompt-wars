import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthButton from '../src/components/AuthButton.jsx';
import { AppProvider } from '../src/context/AppContext.jsx';
import * as api from '../src/api/client.js';

describe('AuthButton component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete window.google;
    vi.spyOn(api, 'getHealth').mockResolvedValue({ ok: true, data: { status: 'ok', llm: 'online', policy_version: '1.0.0' } });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: { account_id: 'ACC-1001', balance_paise: 5000000 } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
  });

  it('renders "Guest session" badge when VITE_GOOGLE_CLIENT_ID is unset', async () => {
    vi.spyOn(api, 'authMe').mockResolvedValue({
      ok: true,
      data: { user: { id: 'usr_guest', kind: 'guest' }, auth: { google_enabled: false } }
    });

    render(
      <AppProvider initialValue={{ user: { id: 'usr_guest', kind: 'guest' } }}>
        <AuthButton />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('guest-badge')).toBeInTheDocument();
      expect(screen.getByText('Guest session')).toBeInTheDocument();
    });
  });

  it('renders "Guest session" badge when auth.google_enabled is false', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    vi.spyOn(api, 'authMe').mockResolvedValue({
      ok: true,
      data: { user: { id: 'usr_guest', kind: 'guest' }, auth: { google_enabled: false } }
    });

    render(
      <AppProvider
        initialValue={{
          user: { id: 'usr_guest', kind: 'guest' },
          auth: { google_enabled: false }
        }}
      >
        <AuthButton />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('guest-badge')).toBeInTheDocument();
    });
  });

  it('renders signed-in name, picture, and Sign out button for Google user', async () => {
    const googleUser = {
      id: 'g_12345',
      name: 'Jane Doe',
      email: 'jane@example.com',
      picture: 'https://example.com/avatar.jpg',
      kind: 'google'
    };

    const logoutSpy = vi.spyOn(api, 'authLogout').mockResolvedValue({ ok: true, data: { ok: true } });
    const guestSpy = vi.spyOn(api, 'authGuest').mockResolvedValue({
      ok: true,
      data: { user: { id: 'usr_guest', kind: 'guest' } }
    });
    const authMeSpy = vi.spyOn(api, 'authMe').mockResolvedValue({
      ok: true,
      data: { user: googleUser, auth: { google_enabled: true } }
    });
    const getAccountSpy = vi.spyOn(api, 'getAccount').mockResolvedValue({
      ok: true,
      data: { account_id: 'ACC-1001', balance_paise: 5000000 }
    });

    render(
      <AppProvider initialValue={{ user: googleUser, auth: { google_enabled: true } }}>
        <AuthButton />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign out/i })).toBeInTheDocument();
    });

    const avatar = screen.getByRole('img', { name: 'Jane Doe' });
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Click Sign out
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(guestSpy).toHaveBeenCalled();
      expect(authMeSpy).toHaveBeenCalled();
      expect(getAccountSpy).toHaveBeenCalled();
    });
  });

  it('initializes google.accounts.id and renders Google button when enabled', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'mock-google-client-id.apps.googleusercontent.com');

    vi.spyOn(api, 'authMe').mockResolvedValue({
      ok: true,
      data: { user: { id: 'usr_demo', kind: 'guest' }, auth: { google_enabled: true } }
    });

    const initializeMock = vi.fn();
    const renderButtonMock = vi.fn();

    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock
        }
      }
    };

    render(
      <AppProvider
        initialValue={{
          user: { id: 'usr_demo', kind: 'guest' },
          auth: { google_enabled: true }
        }}
      >
        <AuthButton />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('google-signin-btn')).toBeInTheDocument();
      expect(initializeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'mock-google-client-id.apps.googleusercontent.com'
        })
      );
      expect(renderButtonMock).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          theme: 'filled_black'
        })
      );
    });
  });
});
