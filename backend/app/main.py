from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from . import models, schemas, crud
from .database import engine, get_db

# Create the tables (In production, use Alembic instead)
models.Base.metadata.create_all(bind=engine)

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
    obs = crud.get_observations(db, skip=skip, limit=limit)
    return obs