from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    question: str

@app.post("/ask")
async def ask(data: Question):

    return {
        "answer": f"Answer for: {data.question}",
        "sources": [
            {
                "file": "NAMDCM_Guide.pdf",
                "page": 12
            }
        ]
    }