import re


def sanitize_filename(name: str) -> str:
    if not name:
        return ""

    # 1) strip whitespace
    name = name.strip()

    # 2) remove path traversal and slashes
    name = name.replace("\\", "/")
    name = name.split("/")[-1]

    # 3) allow only safe chars: letters, numbers, dot, dash, underscore, parentheses
    name = re.sub(r"[^A-Za-z0-9._()\-]", "_", name)

    # 4) collapse multiple underscores
    name = re.sub(r"_+", "_", name)

    # 5) limit length
    if len(name) > 255:
        # keep extension if exists
        parts = name.rsplit(".", 1)
        if len(parts) == 2:
            base, ext = parts
            base = base[:240]  # 240 + '.' + extension <= 255
            name = f"{base}.{ext}"
        else:
            name = name[:255]

    return name
