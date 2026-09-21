from langchain_huggingface import HuggingFaceEmbeddings


def create_embeddings():
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    return embeddings


if __name__ == "__main__":
    embeddings = create_embeddings()

    text = "NADCM is used for hardware management."

    vector = embeddings.embed_query(text)

    print("Embedding created successfully!")
    print("Vector dimensions:", len(vector))
    print("First 10 values:", vector[:10])