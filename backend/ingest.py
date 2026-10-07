# ingest.py - CHATBOT FINAL - GENERIC - NO HARDCODING
import os, pymupdf, docx, re, shutil, zipfile
from pathlib import Path
from collections import Counter
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).parent
DATA_ROOT = BASE_DIR / "data"
DB_PATH = BASE_DIR.parent / "vector_db"
IMAGE_ROOT = BASE_DIR / "extracted_images"

TOPICS = ["hotline","ran","tc30","troubleshoot","comparison","audit"]
for t in TOPICS:
    (DATA_ROOT / t).mkdir(parents=True, exist_ok=True)
    (IMAGE_ROOT / t).mkdir(parents=True, exist_ok=True)
os.makedirs(DB_PATH, exist_ok=True)

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def extract_pdf_with_images(pdf_path: Path, topic: str):
    if pdf_path.name.startswith("~$") or pdf_path.name.startswith("."):
        return []
    print(f"Reading PDF [{topic}]: {pdf_path.name}")
    doc = pymupdf.open(pdf_path)
    records=[]
    for page_num in range(len(doc)):
        text = doc[page_num].get_text("text")
        if text.strip() and len(text.strip())>30:
            records.append({"text": text, "images": [], "source": str(pdf_path), "page": page_num+1, "topic": topic})
    return records

def extract_docx_with_images(docx_path: Path, topic: str):
    if docx_path.name.startswith("~$") or docx_path.name.startswith("."):
        print(f"Skipping temp DOCX [{topic}]: {docx_path.name}")
        return []
    if not zipfile.is_zipfile(docx_path):
        print(f"Skipping invalid DOCX [{topic}]: {docx_path.name}")
        return []
    print(f"Reading DOCX [{topic}]: {docx_path.name}")
    try:
        doc = docx.Document(docx_path)
    except:
        return []
    full_texts=[]
    for p in doc.paragraphs:
        if p.text.strip():
            full_texts.append(p.text.strip())
    # Include tables (your New_TSH.docx has tables)
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join([c.text.strip() for c in row.cells if c.text.strip()])
            if row_text:
                full_texts.append(row_text)
    records = []
    current_block = []   
    for p in doc.paragraphs:
       if not p.text.strip(): continue
    # If this para looks like heading (short, numbered, bold), start new block
       is_heading = p.style.name.startswith('Heading') or re.match(r'^\d+[\.\)]', p.text.strip())
       if is_heading and current_block:
              records.append({"text": "\n".join(current_block), "images": [], "source": str(docx_path), "page": 1, "topic": topic})
              current_block = []
       current_block.append(p.text.strip())

    if current_block:
          records.append({"text": "\n".join(current_block), "images": [], "source": str(docx_path), "page": 1, "topic": topic})
    return records

def atomic_chunking(records):
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=50)
    atomic=[]
    heading_pattern = re.compile(r'^\d+[\.\)]\s+.*|^[A-Z][^a-z]{5,}|^.*Error.*|^.*Issue.*', re.MULTILINE)

    for r in records:
        text = r["text"]
        # FIX 3: Pre-split by headings if found, before fixed splitter
        # This works for ANY document, not just TSH
        sections = re.split(r'\n(?=\d+[\.\)]\s+|\n[A-Z ]{10,}\n)', text)
        if len(sections) <= 1: # no headings found, fallback
            sections = [text]

        for sec in sections:
            if len(sec.strip()) < 50:
                continue
            # Now split large section into small atomic chunks
            if len(sec) > 800:
                chunks = splitter.split_text(sec)
            else:
                chunks = [sec] # Keep small section as is - THIS IS KEY for exact answer

            for ch in chunks:
                if len(ch.strip())>50:
                    # Extract heading for metadata automatically
                    first_line = ch.split('\n')[0][:100]
                    atomic.append(Document(
                        page_content=ch.strip(),
                        metadata={
                            "source": r["source"],
                            "page": r["page"],
                            "topic": r["topic"],
                            "heading": first_line # FIX 4: Add heading metadata
                        }))
    print(f"Created {len(atomic)} chunks from {len(records)} raw")
    return atomic

def main():
    print("\n=== INGEST START ===")
    all_raw=[]
    topic_folders = [d for d in DATA_ROOT.iterdir() if d.is_dir()] if DATA_ROOT.exists() else []
    for topic_dir in topic_folders:
        topic = topic_dir.name.lower()
        mapping = {"helpline":"hotline","tsh":"troubleshoot","ran_support":"ran","tc30_support":"tc30"}
        topic = mapping.get(topic, topic)
        if topic not in TOPICS:
            continue
        print(f"\nScanning: {topic_dir} -> {topic}")
        for filename in os.listdir(topic_dir):
            if filename.startswith("~$") or filename.startswith("."):
                print(f"Skipping temp file [{topic}]: {filename}")
                continue
            fp = topic_dir / filename
            if not fp.is_file():
                continue
            if filename.lower().endswith(".pdf"):
                all_raw.extend(extract_pdf_with_images(fp, topic))
            elif filename.lower().endswith(".docx"):
                all_raw.extend(extract_docx_with_images(fp, topic))
            elif filename.lower().endswith(".txt"):
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    all_raw.append({"text": f.read(), "images": [], "source": str(fp), "page": 1, "topic": topic})
    if not all_raw:
        print("NO FILES")
        return
    atomic_docs = atomic_chunking(all_raw)
    if DB_PATH.exists():
        shutil.rmtree(DB_PATH, ignore_errors=True)
    Chroma.from_documents(documents=atomic_docs, embedding=embeddings, persist_directory=str(DB_PATH))
    counts = Counter([d.metadata["topic"] for d in atomic_docs])
    print(f"DONE - {len(atomic_docs)} - {dict(counts)}")

if __name__ == "__main__":
    main()
