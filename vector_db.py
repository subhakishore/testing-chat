from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


# --------------------------------
# 1. Read extracted PDF text
# --------------------------------

with open("documents/extracted_text.txt", "r", encoding="utf-8") as file:
    text = file.read()


# --------------------------------
# 2. Split text into chunks
# --------------------------------

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = splitter.split_text(text)

print(f"Total chunks: {len(chunks)}")


# --------------------------------
# 3. Create embedding model
# --------------------------------

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# --------------------------------
# 4. Create Chroma vector database
# --------------------------------

vector_db = Chroma.from_texts(
    texts=chunks,
    embedding=embeddings,
    persist_directory="./vector_db"
)


print("Vector database created successfully!")