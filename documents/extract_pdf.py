import pdfplumber


PDF_PATH = "FID.pdf"


def extract_text():
    text = ""

    with pdfplumber.open(PDF_PATH) as pdf:
        print(f"Total pages: {len(pdf.pages)}")

        for page_number, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

            print(f"Processed page {page_number}")

    return text


if __name__ == "__main__":
    text = extract_text()

    print("\nPDF extraction completed!")
    print(f"Characters extracted: {len(text)}")

    with open("extracted_text.txt", "w", encoding="utf-8") as file:
        file.write(text)

    print("Saved as extracted_text.txt")