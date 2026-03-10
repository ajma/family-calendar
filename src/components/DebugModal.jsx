import React, { useState, useEffect } from 'react';

const DebugModal = ({ isOpen, onClose }) => {
    const [localStoreState, setLocalStoreState] = useState('');
    const [errorMSG, setErrorMSG] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadLocalStorage();
        }
    }, [isOpen]);

    const loadLocalStorage = () => {
        try {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key === 'oauth_token') continue;

                const value = localStorage.getItem(key);
                try {
                    // Attempt to parse JSON to pretty-print later
                    data[key] = JSON.parse(value);
                } catch {
                    data[key] = value;
                }
            }
            setLocalStoreState(JSON.stringify(data, null, 2));
            setErrorMSG(null);
        } catch (error) {
            setErrorMSG('Error reading from localStorage: ' + error.message);
        }
    };

    const handleSave = () => {
        try {
            const parsed = JSON.parse(localStoreState);
            const currentToken = localStorage.getItem('oauth_token');

            localStorage.clear();

            if (currentToken) {
                localStorage.setItem('oauth_token', currentToken);
            }

            for (const [key, value] of Object.entries(parsed)) {
                // Stringify objects/arrays before storing
                const valToStore = typeof value === 'object' && value !== null
                    ? JSON.stringify(value)
                    : String(value);
                localStorage.setItem(key, valToStore);
            }

            // Reload page to apply new state securely
            window.location.reload();

        } catch (error) {
            setErrorMSG('Invalid JSON format: ' + error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content glass" style={{ maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <h2>Debug LocalStorage</h2>

                {errorMSG && (
                    <div style={{ padding: '1rem', color: '#ff7b72', background: 'rgba(255,123,114,0.1)', borderBottom: '1px solid var(--border-color)' }}>
                        {errorMSG}
                    </div>
                )}

                <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                        Edit localStorage state directly. Warning: Malformed JSON or invalid data will break the application!
                        Saving will reload the page to apply changes.
                    </p>
                    <textarea
                        value={localStoreState}
                        onChange={(e) => setLocalStoreState(e.target.value)}
                        style={{
                            flex: 1,
                            width: '100%',
                            background: 'var(--bg-color)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '1rem',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            resize: 'none',
                            outline: 'none'
                        }}
                    />
                </div>

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                    <button onClick={handleSave} className="btn-primary" style={{ padding: '0.5rem 1rem', background: '#ff7b72' }}>Save & Reload</button>
                </div>
            </div>
        </div>
    );
};

export default DebugModal;
