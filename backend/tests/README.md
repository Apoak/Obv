# Backend Tests

This directory contains tests for the backend API.

## Running Tests

From the `backend` directory, run:

```bash
# Install test dependencies (if not already installed)
pip install -r requirements.txt

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_auth.py
pytest tests/test_observations.py
pytest tests/test_crud_observations.py

# Run a specific test class
pytest tests/test_auth.py::TestUserRegistration
pytest tests/test_observations.py::TestCreateObservation

# Run with coverage
pytest --cov=app tests/
```

## Test Coverage

### Authentication Tests (`test_auth.py`)

1. **User Registration**
   - Successful registration
   - Duplicate username handling
   - Duplicate email handling
   - Invalid email format
   - Password/username validation

2. **User Login**
   - Login with username
   - Login with email
   - Wrong password handling
   - Non-existent user handling

3. **Protected Routes**
   - Access with valid token
   - Access without token
   - Access with invalid token
   - Access with expired token

4. **Token Validation**
   - Token contains correct username
   - Different users get different tokens

5. **Password Security**
   - Passwords are hashed in database
   - Password verification works correctly

6. **Get Current User (`/auth/me`)**
   - Get current user with valid token
   - Access without token
   - Access with invalid/expired token
   - Returns correct user for token

### Observation Tests (`test_observations.py`)

1. **Create Observation (`POST /observations/`)**
   - Successful creation with authentication
   - Requires authentication (no token)
   - Requires valid token
   - Validates caption (non-empty)
   - Validates image URLs (1-5 required)
   - Validates latitude/longitude ranges
   - Handles missing required fields
   - Tests maximum image limit (5 images)

2. **Get Current User (`GET /auth/me`)**
   - Returns user info with valid token
   - Requires authentication
   - Handles invalid/expired tokens
   - Returns correct user for token

### CRUD Tests (`test_crud_observations.py`)

1. **Observation Schema Validation**
   - Valid observation creation
   - Too many images validation
   - Empty image list validation
   - Invalid latitude/longitude validation
   - Maximum images (5) acceptance
   - Caption length validation

## Test Database

Tests use a temporary SQLite database file to avoid requiring a PostgreSQL instance. 

**Note:** The `Observation` model requires PostGIS (PostgreSQL extension) for geometry operations. Tests that create observations may fail with SQLite due to PostGIS requirements. These tests validate:
- Authentication requirements
- Input validation
- Schema validation
- Endpoint logic

For full integration tests with PostGIS functionality, a PostgreSQL test database with PostGIS extension would be required. The current tests ensure that:
- All authentication checks work correctly
- All input validation works correctly
- The endpoint structure and logic are correct

## Test Files

- `test_auth.py` - Authentication endpoint tests
- `test_observations.py` - Observation endpoint tests
- `test_crud_observations.py` - Observation CRUD and schema validation tests
- `conftest.py` - Pytest fixtures and configuration
