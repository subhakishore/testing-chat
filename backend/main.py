from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import fitz
import ollama
import chromadb

# --- CONFIG: Change this to whatever model you actually have ---
# Run `ollama list` to see your models
POSSIBLE_LLM_MODELS = ["llama3", "llama3.1", "mistral", "gemma2", "phi3", "qwen2"]
OLLAMA_EMBED_MODEL = "nomic-embed-text"
CHROMA_DB_PATH = Path(__file__).parent.parent / "vector_db"
TOP_K = 4

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class Question(BaseModel):
    question: str
    topic: str = "hotline"

client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))
collection = client.get_or_create_collection(name="tass_docs")

def get_topic_from_path(path: Path):
    """Auto-detect topic from folder/file name"""
    p = str(path).lower()
    if "hotline" in p or "helpline" in p:
        return "hotline"
    if "troubleshoot" in p or "tsh" in p:
        return "troubleshoot"
    if "ran" in p:
        return "ran"
    if "tc30" in p:
        return "tc30"
    return "hotline"  # default fallback

def get_pdf_dirs():
    BASE = Path(__file__).parent
    return [
        BASE / "data" / "hotline",
        BASE / "data" / "troubleshoot",
        BASE / "data" / "ran",
        BASE / "data" / "tc30",
        BASE / "data",
        BASE.parent / "documents" / "hotline",
        BASE.parent / "documents" / "troubleshoot",
        BASE.parent / "documents" / "ran",
        BASE.parent / "documents" / "tc30",
        BASE.parent / "documents",
    ]

def chunk_text(text, size=800, overlap=100):
    chunks = []
    start = 0
    while start < len(text):
        c = text[start:start+size].strip()
        if len(c) > 50:
            chunks.append(c)
        start += size - overlap
    return chunks

def find_working_llm():
    """Find first available Ollama model"""
    try:
        models = ollama.list()
        # models is dict like {'models': [{'name': 'mistral:latest'}, ...]}
        available = [m['name'].split(':')[0] for m in models.get('models', [])]
        print(f"Available Ollama models: {available}")
        for wanted in POSSIBLE_LLM_MODELS:
            for avail in available:
                if wanted in avail:
                    print(f"Using LLM model: {avail}")
                    return avail
        if available:
            print(f"Using first available: {available[0]}")
            return available[0]
    except Exception as e:
        print(f"Could not list models: {e}")
    print(f"Falling back to {POSSIBLE_LLM_MODELS[0]}")
    return POSSIBLE_LLM_MODELS[0]

WORKING_LLM = find_working_llm()

def rebuild_db_full():
    """Full rebuild with topic tagging - CALL THIS ONCE after adding topic folders"""
    print("=== FULL REBUILD WITH TOPIC TAGS ===")
    try:
        client.delete_collection("tass_docs")
    except:
        pass
    global collection
    collection = client.get_or_create_collection(name="tass_docs")
    
    pdfs = []
    for d in get_pdf_dirs():
        try:
            d = d.resolve()
            if not d.exists(): continue
            for p in d.glob("*.pdf"):
                if p not in pdfs:
                    pdfs.append(p)
        except:
            pass
    
    print(f"Found PDFs: {[p.name for p in pdfs]}")
    total = 0
    for pdf_path in pdfs:
        topic = get_topic_from_path(pdf_path)
        try:
            doc = fitz.open(pdf_path)
            text = "".join([page.get_text() + "\n" for page in doc])
            chunks = chunk_text(text)
            print(f"  {pdf_path.name} -> topic={topic}, {len(chunks)} chunks")
            ids = [f"{topic}_{pdf_path.name}_{i}" for i in range(len(chunks))]
            metas = [{"file": pdf_path.name, "topic": topic} for _ in chunks]
            collection.add(documents=chunks, metadatas=metas, ids=ids)
            total += len(chunks)
        except Exception as e:
            print(f"Failed {pdf_path}: {e}")
    
    print(f"Rebuilt with {total} chunks")
    return total

# ---- API ----

@app.get("/")
def root():
    count = collection.count()
    # Show per-topic stats
    try:
        data = collection.get()
        from collections import Counter
        topics = Counter([m.get('topic','unknown') for m in data.get('metadatas',[])])
    except:
        topics = {}
    return {"status": "ok", "total_chunks": count, "per_topic": topics, "llm_model": WORKING_LLM}

@app.post("/rebuild-topics")
def rebuild_topics():
    """IMPORTANT: Call this once after you organize PDFs into topic folders. It rebuilds DB with topic tags."""
    total = rebuild_db_full()
    return {"message": "Rebuilt with topic tags", "total_chunks": total}

@app.post("/add-pdf")
def add_pdfs():
    """For adding new PDFs without full rebuild - auto-detects topic"""
    pdfs = []
    for d in get_pdf_dirs():
        try:
            d = d.resolve()
            if not d.exists(): continue
            for p in d.glob("*.pdf"):
                pdfs.append(p)
        except: pass
    
    # Get existing files
    existing = set()
    try:
        existing_data = collection.get()
        for m in existing_data.get('metadatas', []):
            existing.add(m.get('file'))
    except:
        pass
    
    new_pdfs = [p for p in pdfs if p.name not in existing]
    added = 0
    for pdf_path in new_pdfs:
        topic = get_topic_from_path(pdf_path)
        try:
            doc = fitz.open(pdf_path)
            text = "".join([page.get_text() + "\n" for page in doc])
            chunks = chunk_text(text)
            ids = [f"{topic}_{pdf_path.name}_{i}_new" for i in range(len(chunks))]
            metas = [{"file": pdf_path.name, "topic": topic} for _ in chunks]
            collection.add(documents=chunks, metadatas=metas, ids=ids)
            added += len(chunks)
            print(f"Added {pdf_path.name} as {topic}: {len(chunks)} chunks")
        except Exception as e:
            print(f"Failed {pdf_path}: {e}")
    
    return {"added_chunks": added, "total": collection.count()}

@app.post("/ask")
@app.post("/query")
async def ask(data: Question):
    topic = data.topic.lower().strip()
    # Normalize topic names: frontend sends 'hotline', 'troubleshoot', 'ran', 'tc30'
    if topic == "tsh support" or "trouble" in topic:
        topic = "troubleshoot"
    if topic == "helpline":
        topic = "hotline"
    
    query = data.question
    print(f"\n=== QUERY [{topic}] : {query} ===")
    
    if collection.count() == 0:
        return {"answer": "Vector DB empty. Add PDFs to backend/data/[topic]/ and call /rebuild-topics", "sources": []}

    # --- RETRIEVAL WITH TOPIC FILTER ---
    context = ""
    sources = []
    try:
        # Try embedding retrieval with topic filter
        try:
            q_emb = ollama.embeddings(model=OLLAMA_EMBED_MODEL, prompt=query)["embedding"]
            results = collection.query(query_embeddings=[q_emb], n_results=TOP_K, where={"topic": topic})
            # If no results for topic, fallback to all
            if not results.get("documents",[[]])[0]:
                print(f"No results for topic={topic}, searching all topics")
                results = collection.query(query_embeddings=[q_emb], n_results=TOP_K)
        except Exception as e:
            print(f"Embedding search failed {e}, using text search with topic filter")
            try:
                results = collection.query(query_texts=[query], n_results=TOP_K, where={"topic": topic})
                if not results.get("documents",[[]])[0]:
                    results = collection.query(query_texts=[query], n_results=TOP_K)
            except Exception as e2:
                print(f"Filtered search failed {e2}, searching all")
                results = collection.query(query_texts=[query], n_results=TOP_K)

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        
        for d,m in zip(docs, metas):
            context += f"\n\n--- [{m.get('topic')}:{m.get('file')}] ---\n{d}"
            sources.append(m.get('file'))

    except Exception as e:
        print(f"Retrieval error: {e}")
        return {"answer": f"Retrieval error: {e}", "sources": []}

    if not context.strip():
        return {"answer": f"No data found for topic '{topic}' matching '{query}'. Try /rebuild-topics or add PDFs to backend/data/{topic}/", "sources": []}

    # --- OLLAMA GENERATION WITH TOPIC CONTEXT ---
    system_prompt = f"""You are TASS - TMO AI Support System. You are currently in {topic.upper()} mode.
Answer ONLY from the CONTEXT below which is filtered for {topic} domain.
If question is outside {topic}, say: "This question belongs to different support area. Please select correct category."

CONTEXT (filtered for {topic}):
{context}
"""

    user_prompt = f"Question for {topic} support: {query}\n\nGive precise technical answer with bullet points, steps, FIDs from context."

    try:
        global WORKING_LLM
        print(f"Calling Ollama model {WORKING_LLM}...")
        resp = ollama.chat(model=WORKING_LLM, messages=[{"role":"system","content":system_prompt},{"role":"user","content":user_prompt}], options={"temperature":0.1})
        final_answer = resp['message']['content']
    except Exception as e:
        print(f"Ollama failed with {WORKING_LLM}: {e}")
        # Try to find another working model automatically
        WORKING_LLM = find_working_llm()
        try:
            resp = ollama.chat(model=WORKING_LLM, messages=[{"role":"system","content":system_prompt},{"role":"user","content":user_prompt}])
            final_answer = resp['message']['content']
        except Exception as e2:
            final_answer = f"Ollama error: model '{WORKING_LLM}' not found. Run 'ollama pull {WORKING_LLM}' or 'ollama list' to check. Error: {e2}\n\n--- RAW CONTEXT FALLBACK (Topic: {topic}) ---\n{context[:3000]}"

    return {
        "answer": final_answer,
        "sources": [{"file": f} for f in list(set(sources))]
    }
