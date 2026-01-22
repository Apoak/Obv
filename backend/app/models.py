from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry
from database import Base

class Observation(Base):
    __tablename__ = "observations"
    
    id = Column(Integer, primary_key=True, index=True)  # Post ID
    user_id = Column(Integer, nullable=False, index=True)  # User who posted
    caption = Column(String, nullable=False)
    image_urls = Column(JSONB, nullable=False)  # Array of up to 5 image URLs
    location = Column(Geometry('POINT', srid=4326), nullable=False)  # Geographic location
    views = Column(Integer, default=0, nullable=False)  # View counter
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
