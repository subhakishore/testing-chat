from langchain_text_splitters import RecursiveCharacterTextSplitter


with open("extracted_text.txt", "r", encoding="utf-8") as file:
    text = file.read()


splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = splitter.split_text(text)

print(f"Total chunks created: {len(chunks)}")


for i, chunk in enumerate(chunks[:5]):
    print(f"\n--- Chunk {i + 1} ---")
    print(chunk)