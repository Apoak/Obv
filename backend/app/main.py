from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import schemas, crud
from database import get_db
from auth import create_access_token, authenticate_user, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from models import User

app = FastAPI(title="Climber Map API")

# CORS setup for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/observations/", response_model=list[schemas.ObservationResponse])
def read_observations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    obs = crud.get_observations(db=db, skip=skip, limit=limit)
    return obs

@app.get("/observations/{observation_id}", response_model=schemas.ObservationResponse)
def read_observation(observation_id: int, db: Session = Depends(get_db)):
    observation = crud.get_observation(db=db, observation_id=observation_id)
    if observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return observation

@app.post("/observations/{observation_id}/view", response_model=schemas.ObservationResponse)
def increment_observation_views(
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Increment view count for an observation (requires authentication)"""
    observation = crud.increment_views(db=db, observation_id=observation_id, viewer_user_id=current_user.id)
    if observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return observation

# Authentication endpoints
@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username already exists
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    # Check if email already exists
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    # Create new user
    return crud.create_user(db=db, user=user)

@app.post("/auth/login", response_model=schemas.Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user and return JWT token"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}