import pytest
from app import create_flask_app  # Import the factory function


@pytest.fixture
def app():
    """
    Create and configure a new app instance for each test.
    This is required because you are using the Application Factory pattern.
    """
    # Create the app instance using your factory function
    # You can pass 'testing' environment if you have a specific config for it
    app_instance = create_flask_app(env="development")

    # Update configuration for testing
    app_instance.config.update(
        {
            "TESTING": True,  # Enable testing mode (propagates exceptions, etc.)
        }
    )

    yield app_instance


@pytest.fixture
def client(app):
    """
    A test client for the app.
    This allows us to send HTTP requests to the app without running the server.
    """
    return app.test_client()


def test_home_page_status(client):
    """
    Test: Ensure the home page ('/') returns a 200 OK status.
    Since the route is decorated with @logout_required, it should render fine for a guest.
    """
    # Simulate a GET request to the root URL
    response = client.get("/")

    # Check if the status code is 200 (OK)
    assert response.status_code == 200
