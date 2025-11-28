# app/utils/file_utils.py

import re


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a user-provided filename to prevent traversal and unsafe characters.
    Allows only: letters, numbers, dot, dash, underscore.
    Strips any path components.
    """
    if not filename:
        return "unnamed"

    # Remove any path-like structures (/, \, ../ etc.)
    filename = filename.split("/")[-1].split("\\")[-1]

    # Allow ONLY safe characters
    filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)

    # Prevent leading dots (".env" → "env")
    filename = filename.lstrip(".")

    return filename or "unnamed"
