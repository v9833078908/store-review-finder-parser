FROM python:3.12-slim

ARG TARGETARCH

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg nodejs npm \
    && if [ "$TARGETARCH" = "amd64" ]; then \
         mkdir -p /etc/apt/keyrings; \
         curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
           | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg; \
         chmod a+r /etc/apt/keyrings/google-chrome.gpg; \
         echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
           > /etc/apt/sources.list.d/google-chrome.list; \
         apt-get update; \
         apt-get install -y --no-install-recommends google-chrome-stable; \
         ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome; \
         ln -sf /usr/bin/google-chrome-stable /usr/bin/chromium; \
       else \
         apt-get install -y --no-install-recommends chromium; \
       fi \
    && npm install --prefix /app --no-save google-play-scraper \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSER_EXECUTABLE=/usr/bin/chromium

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
