"""
Pytest configuration and fixtures for authentication tests
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import os

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

from database import Base, get_db
from main import app
from models import User

# Use SQLite file-based database for testing (in-memory doesn't work with multiple connections)
# Note: SQLite doesn't support PostGIS, so Observation model won't work
# For auth tests, we only need the User model
import tempfile
TEST_DB_FILE = tempfile.NamedTemporaryFile(delete=False, suffix='.db').name
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

@pytest.fixture(scope="function")
def db_engine():
    """Create a test database engine"""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    # Create only User table (Observation requires PostGIS which SQLite doesn't support)
    User.__table__.create(bind=engine, checkfirst=True)
    yield engine
    # Clean up
    User.__table__.drop(bind=engine, checkfirst=True)
    import os
    if os.path.exists(TEST_DB_FILE):
        os.unlink(TEST_DB_FILE)

@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a test database session"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def client(db_engine, db_session):
    """Create a test client with database override"""
    # Ensure table exists before creating client
    User.__table__.create(bind=db_engine, checkfirst=True)
    
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user_data():
    """Sample user data for testing"""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123"
    }

@pytest.fixture
def created_user(client, test_user_data):
    """Create a user in the database for testing"""
    response = client.post("/auth/register", json=test_user_data)
    assert response.status_code == 201
    return response.json()
