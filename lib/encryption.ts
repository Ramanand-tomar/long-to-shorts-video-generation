import crypto from "crypto";

if (!process.env.ENCRYPTION_KEY) {
  throw new Error("CRITICAL: ENCRYPTION_KEY environment variable is not configured. Failing fast during startup.");
}

const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY;
const KEY = crypto.scryptSync(ENCRYPTION_SECRET, "vidshort_salt", 32);

/**
 * Encrypts a plain-text string using AES-256-GCM (Authenticated Encryption).
 * Returns a colon-separated string: v1:ivHex:ciphertextHex:tagHex.
 */
export function encrypt(text: string): string {
  if (!text) return "";
  
  const iv = crypto.randomBytes(12); // 12 bytes is standard/recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag();
  
  return `v1:${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

/**
 * Decrypts a string. Supports both:
 * - New format (v1:ivHex:ciphertextHex:tagHex) via AES-256-GCM
 * - Legacy format (ivHex:ciphertextHex) via AES-256-CBC for migration compatibility
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  
  const parts = encryptedText.split(":");
  
  if (parts[0] === "v1") {
    // New AES-256-GCM format
    const [, ivHex, ciphertextHex, tagHex] = parts;
    if (!ivHex || !ciphertextHex || !tagHex) {
      throw new Error("Invalid AES-GCM encryption format");
    }
    
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  } else {
    // Legacy AES-256-CBC format (migration compatibility path)
    const ivHex = parts[0];
    const encrypted = parts[1];
    if (!ivHex || !encrypted) {
      throw new Error("Invalid legacy CBC encryption format");
    }
    
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }
}
