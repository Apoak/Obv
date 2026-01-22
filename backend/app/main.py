from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import schemas, crud

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
def read_observations(skip: int = 0, limit: int = 100):
    obs = crud.get_observations(skip=skip, limit=limit)
    return obs

@app.get("/observations/{observation_id}", response_model=schemas.ObservationResponse)
def read_observation(observation_id: int):
    observation = crud.get_observation(observation_id=observation_id)
    if observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return observation

@app.post("/observations/{observation_id}/view", response_model=schemas.ObservationResponse)
def increment_observation_views(
    observation_id: int, 
    request: schemas.ViewIncrementRequest
):
    observation = crud.increment_views(observation_id=observation_id, viewer_user_id=request.viewer_user_id)
    if observation is None:
        raise HTTPException(status_code=404, detail="Observation not found")
    return observation