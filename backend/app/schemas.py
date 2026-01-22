from pydantic import BaseModel, Field, field_validator
from typing import List
from datetime import datetime

class ObservationCreate(BaseModel):
    user_id: int
    caption: str
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
