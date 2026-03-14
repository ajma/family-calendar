import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

function getEncryptionKey(): Buffer {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('TOKEN_ENCRYPTION_KEY is not defined in environment variables');
    }
    return Buffer.from(key, 'hex');
}

/**
 * Encrypts a string using AES-256-CBC.
 * Returns a string in the format "iv:encryptedData" (both hex encoded).
 */
export function encrypt(text: string): string | null {
    if (!text) return null;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a string in the format "iv:encryptedData".
 */
export function decrypt(text: string): string | null {
    if (!text) return null;

    const textParts = text.split(':');
    const firstPart = textParts.shift();
    if (!firstPart) return null;
    
    const iv = Buffer.from(firstPart, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
}
