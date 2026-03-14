import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto';

describe('Crypto Utility', () => {
    it('should encrypt and decrypt a string correctly', () => {
        const secret = 'this-is-a-secret-token-123';
        const encrypted = encrypt(secret);
        
        expect(encrypted).not.toBe(secret);
        expect(encrypted).toContain(':'); // IV and encrypted data separator
        
        const decrypted = decrypt(encrypted as any);
        expect(decrypted).toBe(secret);
    });

    it('should produce different encryptions for the same input (unique IV)', () => {
        const secret = 'same-token';
        const enc1 = encrypt(secret);
        const enc2 = encrypt(secret);
        
        expect(enc1).not.toBe(enc2);
        expect(decrypt(enc1 as any)).toBe(secret);
        expect(decrypt(enc2 as any)).toBe(secret);
    });

    it('should return null for null/undefined input', () => {
        expect(encrypt(null as any)).toBeNull();
        expect(decrypt(null as any)).toBeNull();
    });

    it('should throw error if encryption key is missing', () => {
        const originalKey = process.env.TOKEN_ENCRYPTION_KEY;
        delete process.env.TOKEN_ENCRYPTION_KEY;
        
        expect(() => encrypt('test')).toThrow(/TOKEN_ENCRYPTION_KEY/);
        
        process.env.TOKEN_ENCRYPTION_KEY = originalKey;
    });
});
