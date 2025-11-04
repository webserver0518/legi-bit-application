# scripts/generate_secret_key.py
import secrets

def generate_secret_key(length: int = 64) -> str:
    """
    Generate a random SECRET_KEY string (hex-encoded).

    Args:
        length (int): length of the hex string. Default 64 -> 32 bytes.

    Returns:
        str: the generated SECRET_KEY string.
    """
    if length % 2 != 0:
        raise ValueError("Length must be even (full bytes).")

    return secrets.token_hex(length // 2)

if __name__ == "__main__":
    key = generate_secret_key()
    print(f"SECRET_KEY={key}")
