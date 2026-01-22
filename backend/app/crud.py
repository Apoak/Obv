from sqlalchemy.orm import Session
from . import models, schemas
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

def create_observation(db: Session, observation: schemas.ObservationCreate):
    # Convert lat/lng to a WKT (Well Known Text) Point
    point = f"POINT({observation.longitude} {observation.latitude})"
    
    db_observation = models.Observation(
        caption=observation.caption,
        image_url=observation.image_url,
        location=point
    )
    db.add(db_observation)
    db.commit()
    db.refresh(db_observation)
    return db_observation

def get_observations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Observation).offset(skip).limit(limit).all()