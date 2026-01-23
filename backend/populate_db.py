"""
Script to populate the database with observations that are very close together.
This creates a cluster of observations around a central location for testing.
"""
import random
import sys
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from database import SessionLocal, engine, Base
from models import Observation

# Central location - using a popular climbing area (Yosemite Valley)
# You can change this to any location you want
CENTRAL_LAT = 37.7469  # Yosemite Valley
CENTRAL_LNG = -119.5938

# How close together the observations should be (in degrees)
# 0.01 degrees ≈ 1.1 km, 0.001 degrees ≈ 111 meters
CLUSTER_RADIUS = 0.005  # About 550 meters radius

# Sample data for generating observations
CAPTIONS = [
    "Amazing send on this classic route!",
    "Perfect conditions today - no crowds!",
    "First time here, absolutely stunning views!",
    "Epic climb with great partners!",
    "Challenging route but totally worth it!",
    "Beautiful sunrise from the summit!",
    "Perfect weather for climbing today!",
    "New personal best on this route!",
    "The exposure is incredible up here!",
    "Great day at the crag with friends!",
    "This route is harder than it looks!",
    "Amazing rock quality on this face!",
    "Perfect friction today - sent it!",
    "Classic route, highly recommend!",
    "The view from the top is breathtaking!",
]

IMAGE_URLS_POOL = [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
    "https://images.unsplash.com/photo-1464822759844-d150ad2996e1",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4",
    "https://images.unsplash.com/photo-1516567727245-cd7497d7c0ec",
    "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2",
    "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f",
    "https://images.unsplash.com/photo-1551632811-561732d1e306",
]

def generate_random_location(base_lat: float, base_lng: float, radius: float):
    """Generate a random location within radius of base location"""
    # Generate random offset in a circle
    angle = random.uniform(0, 2 * 3.14159)
    distance = random.uniform(0, radius)
    
    # Convert to lat/lng offset (approximate)
    lat_offset = distance * random.choice([-1, 1]) * random.uniform(0.3, 1.0)
    lng_offset = distance * random.choice([-1, 1]) * random.uniform(0.3, 1.0)
    
    new_lat = base_lat + lat_offset
    new_lng = base_lng + lng_offset
    
    return new_lat, new_lng

def create_observation(db: Session, user_id: int, caption: str, image_urls: list, 
                       latitude: float, longitude: float, views: int = 0):
    """Create a new observation in the database"""
    # Create WKT point for PostGIS
    # Format: POINT(longitude latitude) - note: lng comes first!
    point = WKTElement(f'POINT({longitude} {latitude})', srid=4326)
    
    observation = Observation(
        user_id=user_id,
        caption=caption,
        image_urls=image_urls,
        location=point,
        views=views,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(observation)
    return observation

def populate_database(num_observations: int = 20):
    """Populate the database with clustered observations"""
    print("Connecting to database...")
    
    # Test database connection
    try:
        db: Session = SessionLocal()
        # Try a simple query to test connection
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        print("\nMake sure:")
        print("  1. PostgreSQL is running")
        print("  2. PostGIS extension is installed: CREATE EXTENSION postgis;")
        print("  3. Database 'climber_db' exists")
        print("  4. Connection credentials in database.py are correct")
        return
    
    # Create tables if they don't exist
    print("Creating tables if they don't exist...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Clear existing observations (optional - comment out if you want to keep existing data)
        count = db.query(Observation).count()
        if count > 0:
            db.query(Observation).delete()
            db.commit()
            print(f"Cleared {count} existing observations")
        
        # Generate observations
        print(f"Creating {num_observations} observations clustered around ({CENTRAL_LAT}, {CENTRAL_LNG})...")
        
        for i in range(num_observations):
            # Generate random location within cluster radius
            lat, lng = generate_random_location(CENTRAL_LAT, CENTRAL_LNG, CLUSTER_RADIUS)
            
            # Random user (1-10)
            user_id = random.randint(1, 10)
            
            # Random caption
            caption = random.choice(CAPTIONS)
            
            # Random number of images (1-5)
            num_images = random.randint(1, 5)
            image_urls = random.sample(IMAGE_URLS_POOL, min(num_images, len(IMAGE_URLS_POOL)))
            
            # Random views (0-200)
            views = random.randint(0, 200)
            
            # Create observation
            obs = create_observation(
                db=db,
                user_id=user_id,
                caption=caption,
                image_urls=image_urls,
                latitude=lat,
                longitude=lng,
                views=views
            )
            
            print(f"  Created observation {i+1}/{num_observations}: {caption[:50]}... at ({lat:.6f}, {lng:.6f})")
        
        # Commit all observations
        db.commit()
        print(f"\n✅ Successfully created {num_observations} observations!")
        print(f"   All observations are within ~{CLUSTER_RADIUS * 111:.1f} km of ({CENTRAL_LAT}, {CENTRAL_LNG})")
        
        # Show some stats
        all_obs = db.query(Observation).all()
        print(f"\n📊 Database now contains {len(all_obs)} total observations")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error populating database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    
    # Number of observations to create (default 20, can be overridden)
    num_obs = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    
    print("=" * 60)
    print("MountainMate Database Population Script")
    print("=" * 60)
    print()
    
    populate_database(num_observations=num_obs)
