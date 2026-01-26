from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import timedelta
import os
import uuid
import shutil
from pathlib import Path
import traceback
import schemas, crud
from database import get_db
from auth import create_access_token, authenticate_user, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from models import User

app = FastAPI(title="Climber Map API")

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/observations")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Get API base URL for generating full image URLs
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# CORS setup for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    
)

# Mount static files for serving uploaded images
app.mount("/static", StaticFiles(directory="uploads"), name="static")

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

@app.post("/observations/", response_model=schemas.ObservationResponse, status_code=status.HTTP_201_CREATED)
def create_observation(
    observation: schemas.ObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new observation with image URLs (requires authentication)"""
    return crud.create_observation(db=db, observation=observation, user_id=current_user.id)

@app.post("/observations/upload", response_model=schemas.ObservationResponse, status_code=status.HTTP_201_CREATED)
async def create_observation_with_upload(
    caption: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    images: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new observation with file uploads (requires authentication)"""
    observation = None
    obs_dir = None
    
    try:
        # Validate number of images
        if len(images) == 0:
            raise HTTPException(status_code=400, detail="At least one image is required")
        if len(images) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 images allowed")
        
        # Validate coordinates
        if latitude < -90 or latitude > 90:
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        if longitude < -180 or longitude > 180:
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
        
        # Validate caption
        if not caption or len(caption.strip()) == 0:
            raise HTTPException(status_code=400, detail="Caption is required")
        if len(caption) > 500:
            raise HTTPException(status_code=400, detail="Caption must be 500 characters or less")
        
        # Create observation first to get the ID
        observation_data = schemas.ObservationCreate(
            caption=caption.strip(),
            image_urls=["placeholder"],  # Temporary placeholder to pass validation
            latitude=latitude,
            longitude=longitude
        )
        
        # Create observation in database (temporarily with placeholder image_urls)
        observation = crud.create_observation_with_files(
            db=db, 
            observation=observation_data, 
            user_id=current_user.id
        )
        
        # Create directory for this observation's images
        obs_dir = UPLOAD_DIR / str(observation.id)
        obs_dir.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded files and collect URLs
        image_urls = []
        for image in images:
            # Validate file type
            if not image.content_type or not image.content_type.startswith('image/'):
                # Clean up directory if validation fails
                if obs_dir and obs_dir.exists():
                    shutil.rmtree(obs_dir, ignore_errors=True)
                raise HTTPException(status_code=400, detail=f"{image.filename} is not a valid image file")
            
            # Generate unique filename
            file_ext = Path(image.filename).suffix if image.filename else '.jpg'
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = obs_dir / unique_filename
            
            # Save file
            try:
                # Read file content
                contents = await image.read()
                with open(file_path, "wb") as buffer:
                    buffer.write(contents)
                
                # Generate full URL for the saved file
                image_url = f"{API_BASE_URL}/static/observations/{observation.id}/{unique_filename}"
                image_urls.append(image_url)
            except Exception as e:
                # Clean up on error
                if obs_dir and obs_dir.exists():
                    shutil.rmtree(obs_dir, ignore_errors=True)
                raise HTTPException(status_code=500, detail=f"Error saving image: {str(e)}")
        
        # Update observation with image URLs
        updated_observation = crud.update_observation_image_urls(
            db=db,
            observation_id=observation.id,
            image_urls=image_urls
        )
        
        if updated_observation is None:
            raise HTTPException(status_code=500, detail="Failed to update observation with image URLs")
        
        return updated_observation
        
    except HTTPException:
        # Re-raise HTTP exceptions (they already have proper status codes)
        raise
    except SQLAlchemyError as e:
        # Rollback database transaction on database errors
        db.rollback()
        # Clean up directory if it was created
        if obs_dir and obs_dir.exists():
            shutil.rmtree(obs_dir, ignore_errors=True)
        # Clean up observation if it was created
        if observation:
            try:
                from models import Observation
                db_obs = db.query(Observation).filter(Observation.id == observation.id).first()
                if db_obs:
                    db.delete(db_obs)
                    db.commit()
            except:
                db.rollback()
        print(f"Database error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        # Clean up on any other error
        if obs_dir and obs_dir.exists():
            shutil.rmtree(obs_dir, ignore_errors=True)
        if observation:
            try:
                from models import Observation
                db_obs = db.query(Observation).filter(Observation.id == observation.id).first()
                if db_obs:
                    db.delete(db_obs)
                    db.commit()
            except:
                db.rollback()
        print(f"Unexpected error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

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

@app.get("/auth/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return current_user