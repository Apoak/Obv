from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import List, Optional
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Observation schemas
class ObservationCreate(BaseModel):
    caption: str = Field(..., min_length=1, max_length=500)
    image_urls: List[str] = Field(..., min_length=1, max_length=5, description="Array of 1-5 image URLs")
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)
    
    @field_validator('image_urls')
    @classmethod
    def validate_image_urls(cls, v):
        if len(v) > 5:
            raise ValueError('Maximum 5 images allowed')
        if len(v) == 0:
            raise ValueError('At least 1 image is required')
        return v

class ObservationResponse(BaseModel):
    id: int  # Post ID
    user_id: int
    caption: str
    image_urls: List[str]
    longitude: float
    latitude: float
    views: int
    created_at: datetime
    updated_at: datetime

class ViewIncrementRequest(BaseModel):
    viewer_user_id: int
