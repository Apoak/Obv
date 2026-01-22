from datetime import datetime
import schemas

# Fake in-memory data store
_fake_observations = [
    {
        "id": 1,
        "user_id": 1,
        "caption": "Beautiful sunrise from the summit!",
        "image_urls": ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4"],
        "longitude": -122.4194,
        "latitude": 37.7749,
        "views": 42,
        "created_at": datetime(2024, 1, 15, 8, 30, 0),
        "updated_at": datetime(2024, 1, 15, 8, 30, 0),
    },
    {
        "id": 2,
        "user_id": 2,
        "caption": "Epic climb today! The view was worth it.",
        "image_urls": [
            "https://images.unsplash.com/photo-1464822759844-d150ad2996e1",
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"
        ],
        "longitude": -105.2705,
        "latitude": 40.0150,
        "views": 18,
        "created_at": datetime(2024, 1, 16, 14, 20, 0),
        "updated_at": datetime(2024, 1, 16, 14, 20, 0),
    },
    {
        "id": 3,
        "user_id": 1,
        "caption": "Challenging route but made it to the top!",
        "image_urls": [
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
            "https://images.unsplash.com/photo-1464822759844-d150ad2996e1"
        ],
        "longitude": -121.4944,
        "latitude": 38.5816,
        "views": 67,
        "created_at": datetime(2024, 1, 17, 10, 15, 0),
        "updated_at": datetime(2024, 1, 17, 10, 15, 0),
    },
    {
        "id": 4,
        "user_id": 3,
        "caption": "First time here, absolutely stunning!",
        "image_urls": ["https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05"],
        "longitude": -118.2437,
        "latitude": 34.0522,
        "views": 23,
        "created_at": datetime(2024, 1, 18, 16, 45, 0),
        "updated_at": datetime(2024, 1, 18, 16, 45, 0),
    },
    {
        "id": 5,
        "user_id": 2,
        "caption": "Perfect weather for climbing today!",
        "image_urls": [
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
            "https://images.unsplash.com/photo-1464822759844-d150ad2996e1",
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"
        ],
        "longitude": -111.8910,
        "latitude": 40.7608,
        "views": 91,
        "created_at": datetime(2024, 1, 19, 12, 0, 0),
        "updated_at": datetime(2024, 1, 19, 12, 0, 0),
    },
]

def get_observations(skip: int = 0, limit: int = 100):
    """Get observations with pagination"""
    return _fake_observations[skip:skip + limit]

def get_observation(observation_id: int):
    """Get a single observation by ID"""
    for obs in _fake_observations:
        if obs["id"] == observation_id:
            return obs
    return None

def increment_views(observation_id: int, viewer_user_id: int):
    """
    Increment views count only if the viewer is not the poster.
    Returns the updated observation or None if not found.
    """
    observation = get_observation(observation_id)
    
    if not observation:
        return None
    
    # Only increment if viewer is not the poster
    if observation["user_id"] != viewer_user_id:
        observation["views"] += 1
        observation["updated_at"] = datetime.now()
    
    return observation