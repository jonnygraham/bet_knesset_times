FROM public.ecr.aws/lambda/python:3.12

# Install Playwright system dependencies (not chromium itself — Playwright bundles it)
RUN dnf install -y \
    nss atk cups-libs libdrm libXcomposite \
    libXdamage libXrandr mesa-libgbm pango alsa-lib \
    libXScrnSaver gtk3 dbus-glib \
    && dnf clean all

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY app.py .

CMD ["app.handler"]
