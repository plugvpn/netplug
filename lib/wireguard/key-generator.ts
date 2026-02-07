import { createPrivateKey, createPublicKey } from "crypto";
import { execSync } from "child_process";

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Generate a WireGuard key pair using the wg command-line tool
 * This is the most reliable method as it uses the official WireGuard utilities
 */
export function generateWireGuardKeyPair(): WireGuardKeyPair {
  try {
    // Generate private key
    const privateKey = execSync("wg genkey", { encoding: "utf-8" }).trim();

    // Generate public key from private key
    const publicKey = execSync(`echo "${privateKey}" | wg pubkey`, {
      encoding: "utf-8",
      shell: "/bin/bash",
    }).trim();

    return {
      privateKey,
      publicKey,
    };
  } catch (error) {
    console.error("Failed to generate WireGuard key pair using wg command:", error);

    // Fallback: Try using Node.js crypto if wg command is not available
    return generateWireGuardKeyPairFallback();
  }
}

/**
 * Fallback method to generate WireGuard key pair using Node.js crypto
 * Uses X25519 (Curve25519) which is what WireGuard uses
 */
function generateWireGuardKeyPairFallback(): WireGuardKeyPair {
  try {
    // Generate a random 32-byte private key
    const crypto = require("crypto");
    const privateKeyBytes = crypto.randomBytes(32);

    // Clamp the private key according to Curve25519 spec
    privateKeyBytes[0] &= 248;
    privateKeyBytes[31] &= 127;
    privateKeyBytes[31] |= 64;

    // Convert to base64 (WireGuard key format)
    const privateKey = privateKeyBytes.toString("base64");

    // Generate public key from private key using X25519
    const privateKeyObject = createPrivateKey({
      key: privateKeyBytes,
      format: "der",
      type: "pkcs8",
    });

    const publicKeyObject = createPublicKey(privateKeyObject);
    const publicKeyBytes = publicKeyObject.export({ format: "der", type: "spki" });
    const publicKey = publicKeyBytes.toString("base64");

    return {
      privateKey,
      publicKey,
    };
  } catch (error) {
    console.error("Failed to generate WireGuard key pair using crypto fallback:", error);
    throw new Error("Unable to generate WireGuard key pair. Please ensure WireGuard tools are installed.");
  }
}

/**
 * Generate a preshared key (optional, for additional security)
 * This is a random 32-byte value encoded in base64
 */
export function generatePresharedKey(): string {
  try {
    return execSync("wg genpsk", { encoding: "utf-8" }).trim();
  } catch (error) {
    // Fallback to crypto
    const crypto = require("crypto");
    return crypto.randomBytes(32).toString("base64");
  }
}
