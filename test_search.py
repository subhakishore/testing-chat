from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings


# Create embedding model
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


# Load existing Chroma database
vector_db = Chroma(
    persist_directory="./vector_db",
    embedding_function=embeddings
)


# Ask a question
query = "No connection"


# Search relevant chunks
results = vector_db.similarity_search(query, k=3)


print("\nSearch results:\n")


for i, result in enumerate(results, start=1):

    print(f"========== Result {i} ==========")

    print(result.page_content)

    print()