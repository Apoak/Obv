from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Observation, User
import schemas
from auth import get_password_hash, verify_password

def _observation_to_response(db: Session, observation: Observation) -> schemas.ObservationResponse:
    """Helper function to convert Observation model to ObservationResponse schema"""
    # Extract longitude and latitude from PostGIS geometry
    # ST_X returns longitude, ST_Y returns latitude
    coords = db.query(
        func.ST_X(Observation.location).label('longitude'),
        func.ST_Y(Observation.location).label('latitude')
    ).filter(Observation.id == observation.id).first()
    
    return schemas.ObservationResponse(
        id=observation.id,
        user_id=observation.user_id,
        caption=observation.caption,
        image_urls=observation.image_urls,
        longitude=coords.longitude,
        latitude=coords.latitude,
        views=observation.views,
        created_at=observation.created_at,
        updated_at=observation.updated_at
    )

def get_observations(db: Session, skip: int = 0, limit: int = 100):
    """Get observations with pagination"""
    observations = db.query(Observation).offset(skip).limit(limit).all()
    return [_observation_to_response(db, obs) for obs in observations]

def get_observation(db: Session, observation_id: int):
    """Get a single observation by ID"""
    observation = db.query(Observation).filter(Observation.id == observation_id).first()
    
    if observation is None:
        return None
    
    return _observation_to_response(db, observation)

def increment_views(db: Session, observation_id: int, viewer_user_id: int):
    """
    Increment views count only if the viewer is not the poster.
    Returns the updated observation or None if not found.
    """
    observation = db.query(Observation).filter(Observation.id == observation_id).first()
    
    if not observation:
        return None
    
    # Only increment if viewer is not the poster
    if observation.user_id != viewer_user_id:
        observation.views += 1
        db.commit()
        db.refresh(observation)
    
    return _observation_to_response(db, observation)

# User CRUD operations
def get_user(db: Session, user_id: int) -> User | None:
    """Get a user by ID"""
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_username(db: Session, username: str) -> User | None:
    """Get a user by username"""
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> User | None:
    """Get a user by email"""
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate) -> User:
    """Create a new user with hashed password"""
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Authenticate a user by username/email and password"""
    # Try to find user by username first
    user = get_user_by_username(db, username=username)
    # If not found, try email
    if not user:
        user = get_user_by_email(db, email=username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
