import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config import HOST, PORT, FRONTEND_URL
from api import auth, rag, quotation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # List of allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # List of allowed methods
    allow_headers=["*"],  # List of allowed headers
)
app.include_router(auth.router, prefix="/api/authentication", tags=["auth"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(quotation.router, prefix="/api/quotation", tags=["quotation"])


@app.get("/")
def read_root():
    return {"Hello": "World"}



if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
