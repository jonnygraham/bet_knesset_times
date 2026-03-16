FROM mcr.microsoft.com/playwright/python:v1.51.0-noble

# Install Lambda runtime interface client
RUN pip install --no-cache-dir awslambdaric

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENTRYPOINT ["python", "-m", "awslambdaric"]
CMD ["app.handler"]
