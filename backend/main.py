from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import fitz  # pip install pymupdf

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

DATA_DIR = Path(__file__).parent / "data"
# Cache all PDF text on startup
DOCUMENTS = []

def load_all_pdfs():
    print(f"Loading PDFs from {DATA_DIR}")
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(exist_ok=True)
        return
    for pdf_path in DATA_DIR.glob("*.pdf"):
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text() + "\n"
            DOCUMENTS.append({"file": pdf_path.name, "text": text})
            print(f"Loaded: {pdf_path.name} ({len(text)} chars)")
        except Exception as e:
            print(f"Failed to load {pdf_path.name}: {e}")

load_all_pdfs()

@app.post("/ask")
async def ask(data: Question):
    query = data.question.lower()
    if not DOCUMENTS:
        return {"answer": "No PDFs found in backend/data/ folder. Please add files.", "sources": []}

    # Simple keyword search - finds paragraphs that contain your question words
    best_match = None
    best_file = None
    max_score = 0
    
    query_words = query.split()

    for doc in DOCUMENTS:
        # split into paragraphs
        paragraphs = doc["text"].split("\n\n")
        for para in paragraphs:
            if len(para.strip()) < 20:
                continue
            score = sum(1 for w in query_words if w in para.lower())
            if score > max_score:
                max_score = score
                best_match = para.strip()
                best_file = doc["file"]

    if not best_match:
        return {
            "answer": f"No relevant text found for '{data.question}' in loaded documents.",
            "sources": []
        }

    return {
        "answer": best_match,  # <-- THIS is now actual text from PDF
        "sources": [{"file": best_file}]
    }

@app.get("/")
def root():
    return {"status": "ok", "loaded_files": [d["file"] for d in DOCUMENTS]}