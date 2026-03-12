/**
 * Centralized fetch wrapper for all API calls to our backend.
 *
 * If the server responds with 401 or 403, a custom DOM event is dispatched
 * so that App.jsx can log the user out automatically — regardless of which
 * service function triggered the request.
 */
export async function apiClient(url, options = {}) {
    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new CustomEvent('api-unauthorized'));
        // Still throw so the caller's catch block can react if needed
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Unauthorized (${response.status})`);
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return response.json();
}
