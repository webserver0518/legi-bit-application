# app/__main__.py
import os

from . import create_flask_app


def main() -> None:
    """Create the Flask application and start the development server."""
    env = os.environ.get("FLASK_ENV", "development")
    app = create_flask_app(env)

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("FLASK_SERVER_PORT", "9000")),
        debug=env != "production",
    )

if __name__ == "__main__":
    main()