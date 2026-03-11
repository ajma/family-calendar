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
