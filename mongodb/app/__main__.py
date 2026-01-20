# app/__main__.py
import os

from . import create_flask_app


def main() -> None:
    """Create the Flask application and start the server."""
    app = create_flask_app()

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("MONGODB_SERVER_PORT", 8001))
    )

if __name__ == "__main__":
    main()