import React, { useState, useEffect } from 'react';

const DebugModal = ({ isOpen, onClose, onBackendSave, onFullReset }) => {
    const [localStoreState, setLocalStoreState] = useState('');
    const [errorMSG, setErrorMSG] = useState(null);
    const [isResetConfirming, setIsResetConfirming] = useState(false);
    const [resetConfirmationText, setResetConfirmationText] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadLocalStorage();
            setIsResetConfirming(false);
            setResetConfirmationText('');
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

            // Also try saving to the backend so it isn't overwritten on reload
            if (onBackendSave) {
                const newConfigs = parsed['calendar_configs'] || {};
                const newPeople = parsed['people'] || [];
                onBackendSave(newConfigs, newPeople).then(() => {
                    window.location.reload();
                }).catch(err => {
                    setErrorMSG('Failed to save to backend: ' + err.message);
                });
            } else {
                window.location.reload();
            }

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

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>

                    {/* DANGER ZONE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,123,114,0.05)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,123,114,0.3)' }}>
                        {!isResetConfirming ? (
                            <button
                                onClick={() => setIsResetConfirming(true)}
                                className="btn-secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#ff7b72', borderColor: '#ff7b72' }}
                            >
                                ⚠️ Full Reset
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="Type DELETE"
                                    value={resetConfirmationText}
                                    onChange={(e) => setResetConfirmationText(e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '100px', background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid #ff7b72', borderRadius: '4px' }}
                                />
                                <button
                                    onClick={async () => {
                                        if (onFullReset) {
                                            try {
                                                await onFullReset();
                                            } catch (err) {
                                                setErrorMSG(err.message);
                                                setIsResetConfirming(false);
                                                setResetConfirmationText('');
                                            }
                                        }
                                    }}
                                    disabled={resetConfirmationText !== 'DELETE'}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.8rem',
                                        background: resetConfirmationText === 'DELETE' ? '#ff7b72' : 'var(--bg-color)',
                                        color: resetConfirmationText === 'DELETE' ? '#fff' : 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        cursor: resetConfirmationText === 'DELETE' ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => { setIsResetConfirming(false); setResetConfirmationText(''); }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                        <button onClick={handleSave} className="btn-primary" style={{ padding: '0.5rem 1rem', background: '#ff7b72' }}>Save & Reload</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugModal;
