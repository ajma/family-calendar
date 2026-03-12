export const fetchSettings = async (accessToken) => {
    const response = await fetch('/api/settings', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch settings');
    }
    return response.json();
};

export const saveSettings = async (accessToken, calendarConfigs, people) => {
    const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarConfigs, people }),
    });
    if (!response.ok) {
        throw new Error('Failed to save settings');
    }
    return response.json();
};

export const resetSettings = async (accessToken) => {
    const response = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to reset settings');
    }
    return data;
};

/**
 * Exchange a one-time Google authorization code for an access token.
 * The backend stores the refresh token securely; this returns only the
 * short-lived access token and its expiry timestamp.
 *
 * @param {string} code - The auth code received from Google's OAuth popup.
 * @returns {{ access_token: string, expiry_date: number }}
 */
export const exchangeCode = async (code) => {
    const response = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange auth code');
    }
    return data; // { access_token, expiry_date }
};

/**
 * Use the stored refresh token to silently obtain a new access token.
 * The current (still-valid) access token is used to authenticate the request
 * so the server can identify the user.
 *
 * @param {string} accessToken - The current, still-valid access token.
 * @returns {{ access_token: string, expiry_date: number }}
 */
export const refreshAccessToken = async (accessToken) => {
    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh access token');
    }
    return data; // { access_token, expiry_date }
};
