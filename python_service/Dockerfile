FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK VADER lexicon for Intelligence Layer NLP
# Local dev: python -m nltk.downloader vader_lexicon
RUN python -m nltk.downloader vader_lexicon

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
