import logging
import re
from flask import request
from colorama import Fore, Style, init as colorama_init

# Enable ANSI colors everywhere (even inside docker logs)
colorama_init(strip=False, convert=False)


class CustomFormatter(logging.Formatter):
    LEVEL_COLORS = {
        "DEBUG": Fore.CYAN,
        "INFO": Fore.GREEN,
        "WARNING": Fore.YELLOW,
        "ERROR": Fore.RED,
        "CRITICAL": Fore.MAGENTA,
    }

    def format(self, record):
        # ✅ Color level names
        level_text = record.levelname  # real text
        padded = level_text.ljust(8)  # pad BEFORE coloring
        color = self.LEVEL_COLORS.get(level_text, "")
        record.levelname = f"{color}{padded}{Style.RESET_ALL}"

        # ✅ Handle Werkzeug access logs separately
        if record.name == "werkzeug":
            record.filename = "werkzeug"
            record.lineno = 0

            # Clean IP + dashes + timestamp
            # Example raw:
            # 127.0.0.1 - - [30/Oct/2025 17:12:40] "GET /healthz HTTP/1.1" 200 -
            match = re.search(r'"([A-Z]+) (.*?) HTTP/.*" (\d+)', record.msg)
            if match:
                method, path, status = match.groups()
                record.msg = f"{method} {path} {status}"
            else:
                # fallback: just remove IP part
                record.msg = re.sub(r'^\S+ - - \[[^\]]+\] ', '', record.msg)

            return super().format(record)

        # ✅ App logs → include request path
        try:
            method = request.method
            path = request.path
            record.msg = f"{method} {path} | {record.msg}"
        except RuntimeError:
            pass

        return super().format(record)


def configure_logging(app):
    # ✅ Remove Flask default handler
    app.logger.handlers.clear()

    # ✅ Console handler (stdout)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)

    formatter = CustomFormatter(
        fmt="%(asctime)s | %(levelname)-8s | %(filename)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # ✅ Apply custom formatter
    console_handler.setFormatter(formatter)
    app.logger.addHandler(console_handler)

    # ✅ Allow debug logs if enabled
    app.logger.setLevel(logging.DEBUG)

    # ✅ Override Werkzeug logger to use same format
    werkzeug_logger = logging.getLogger("werkzeug")
    werkzeug_logger.handlers.clear()
    werkzeug_handler = logging.StreamHandler()
    werkzeug_handler.setFormatter(formatter)
    werkzeug_logger.addHandler(werkzeug_handler)
    werkzeug_logger.setLevel(logging.ERROR)

    app.logger.info("✅ Logging system initialized")
