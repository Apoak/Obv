"""
Tests for observation CRUD operations
Note: These tests may have limited functionality with SQLite due to PostGIS requirements
"""
import pytest
from sqlalchemy.orm import Session
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))
import schemas


class TestCreateObservationCRUD:
    """Tests for create_observation CRUD function"""
    
    def test_create_observation_schema_validation(self):
        """Test that ObservationCreate schema validates correctly"""
        # Valid observation
        valid_obs = schemas.ObservationCreate(
            caption="Test caption",
            image_urls=["https://example.com/image.jpg"],
            latitude=37.7749,
            longitude=-122.4194
        )
        assert valid_obs.caption == "Test caption"
        assert len(valid_obs.image_urls) == 1
        assert valid_obs.latitude == 37.7749
        assert valid_obs.longitude == -122.4194
    
    def test_create_observation_schema_too_many_images(self):
        """Test that ObservationCreate schema rejects too many images"""
        with pytest.raises(ValueError, match="Maximum 5 images allowed"):
            schemas.ObservationCreate(
                caption="Test caption",
                image_urls=[
                    "https://example.com/image1.jpg",
                    "https://example.com/image2.jpg",
                    "https://example.com/image3.jpg",
                    "https://example.com/image4.jpg",
                    "https://example.com/image5.jpg",
                    "https://example.com/image6.jpg"  # Too many
                ],
                latitude=37.7749,
                longitude=-122.4194
            )
    
    def test_create_observation_schema_no_images(self):
        """Test that ObservationCreate schema rejects empty image list"""
        with pytest.raises(ValueError, match="At least 1 image is required"):
            schemas.ObservationCreate(
                caption="Test caption",
                image_urls=[],
                latitude=37.7749,
                longitude=-122.4194
            )
    
    def test_create_observation_schema_invalid_latitude(self):
        """Test that ObservationCreate schema validates latitude range"""
        with pytest.raises(Exception):  # Pydantic validation error
            schemas.ObservationCreate(
                caption="Test caption",
                image_urls=["https://example.com/image.jpg"],
                latitude=91.0,  # Invalid: > 90
                longitude=-122.4194
            )
    
    def test_create_observation_schema_invalid_longitude(self):
        """Test that ObservationCreate schema validates longitude range"""
        with pytest.raises(Exception):  # Pydantic validation error
            schemas.ObservationCreate(
                caption="Test caption",
                image_urls=["https://example.com/image.jpg"],
                latitude=37.7749,
                longitude=181.0  # Invalid: > 180
            )
    
    def test_create_observation_schema_max_images(self):
        """Test that ObservationCreate schema accepts exactly 5 images"""
        valid_obs = schemas.ObservationCreate(
            caption="Test caption",
            image_urls=[
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg",
                "https://example.com/image3.jpg",
                "https://example.com/image4.jpg",
                "https://example.com/image5.jpg"
            ],
            latitude=37.7749,
            longitude=-122.4194
        )
        assert len(valid_obs.image_urls) == 5
    
    def test_create_observation_schema_caption_length(self):
        """Test that ObservationCreate schema validates caption length"""
        # Valid caption
        valid_obs = schemas.ObservationCreate(
            caption="A" * 500,  # Max length
            image_urls=["https://example.com/image.jpg"],
            latitude=37.7749,
            longitude=-122.4194
        )
        assert len(valid_obs.caption) == 500
        
        # Empty caption should fail
        with pytest.raises(Exception):  # Pydantic validation error
            schemas.ObservationCreate(
                caption="",
                image_urls=["https://example.com/image.jpg"],
                latitude=37.7749,
                longitude=-122.4194
            )
