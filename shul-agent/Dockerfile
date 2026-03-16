FROM public.ecr.aws/lambda/python:3.12

RUN dnf install -y \
    chromium nss atk cups-libs libdrm libXcomposite \
    libXdamage libXrandr mesa-libgbm pango alsa-lib \
    && dnf clean all

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium

COPY app.py .

CMD ["app.handler"]
