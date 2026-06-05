"""
Encryption service for sensitive data (credentials)
Uses AES-256-GCM for encryption
"""

import base64
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings
from app.core.logging import logger


class EncryptionService:
    """Service for encrypting and decrypting sensitive data using AES-256-GCM"""

    VERSION = "v1"
    ALGORITHM = "aes256gcm"
    NONCE_SIZE = 12  # 96 bits recommended for GCM

    def __init__(self, key: Optional[str] = None):
        """
        Initialize encryption service.

        Args:
            key: 32-byte hex-encoded encryption key (64 hex characters)
        """
        key_hex = key or settings.ENCRYPTION_KEY

        # Convert hex key to bytes (must be exactly 64 hex chars = 32 bytes for AES-256)
        try:
            if len(key_hex) != 64:
                raise ValueError(
                    f"ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). "
                    f"Got {len(key_hex)} characters. "
                    f"Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            self.key = bytes.fromhex(key_hex)
            self.aesgcm = AESGCM(self.key)
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to initialize encryption service: {e}")
            raise ValueError("Invalid encryption key")

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string.

        Args:
            plaintext: String to encrypt

        Returns:
            Encrypted string in format: v1:aes256gcm:<base64_encoded_nonce_ciphertext>
        """
        try:
            # Generate random nonce
            nonce = os.urandom(self.NONCE_SIZE)

            # Encrypt
            ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode(), None)

            # Combine nonce + ciphertext and encode as base64
            combined = nonce + ciphertext
            encoded = base64.b64encode(combined).decode()

            # Return formatted string
            return f"{self.VERSION}:{self.ALGORITHM}:{encoded}"

        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError("Encryption failed")

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string.

        Args:
            ciphertext: Encrypted string in format v1:aes256gcm:<base64_data>

        Returns:
            Decrypted plaintext string
        """
        try:
            # Parse format
            parts = ciphertext.split(":")
            if len(parts) != 3:
                raise ValueError("Invalid ciphertext format")

            version, algorithm, encoded = parts

            if version != self.VERSION or algorithm != self.ALGORITHM:
                raise ValueError(f"Unsupported encryption: {version}:{algorithm}")

            # Decode base64
            combined = base64.b64decode(encoded)

            # Split nonce and ciphertext
            nonce = combined[:self.NONCE_SIZE]
            encrypted_data = combined[self.NONCE_SIZE:]

            # Decrypt
            plaintext = self.aesgcm.decrypt(nonce, encrypted_data, None)

            return plaintext.decode()

        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Decryption failed")

    def is_encrypted(self, value: str) -> bool:
        """
        Check if a value is encrypted with this service.

        Args:
            value: String to check

        Returns:
            True if the value appears to be encrypted
        """
        if not value:
            return False

        parts = value.split(":")
        return (
            len(parts) == 3
            and parts[0] == self.VERSION
            and parts[1] == self.ALGORITHM
        )


# Singleton instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get the encryption service singleton"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


def encrypt(plaintext: str) -> str:
    """Encrypt a string"""
    return get_encryption_service().encrypt(plaintext)


def decrypt(ciphertext: str) -> str:
    """Decrypt an encrypted string"""
    return get_encryption_service().decrypt(ciphertext)


def is_encrypted(value: str) -> bool:
    """Check if a value is encrypted"""
    return get_encryption_service().is_encrypted(value)
