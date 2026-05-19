FROM python:3.13-slim

EXPOSE 9001
EXPOSE 9111
WORKDIR /opt/wsgi

# Install system dependencies including uwsgi and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    git \
    tzdata \
 && rm -rf /var/lib/apt/lists/*

# Set timezone
ENV TZ=America/Chicago
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create system group and user
ENV SERVICE_NAME="uwsgi"
RUN addgroup --gid 1001 --system $SERVICE_NAME && \
    adduser --uid 1001 --gid 1001 --system --disabled-login --shell /bin/false $SERVICE_NAME && \
    mkdir -p /var/log/$SERVICE_NAME && \
    mkdir -p /opt/venv && \
    chown $SERVICE_NAME:$SERVICE_NAME /var/log/$SERVICE_NAME /opt/venv /opt/wsgi
USER $SERVICE_NAME

# Create virtual environment
ENV VENV_PATH="/opt/venv"
RUN python3 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# Upgrade pip inside venv
RUN pip install --upgrade pip setuptools wheel uwsgi

# Copy pyproject.toml early for caching
COPY --chown=$SERVICE_NAME:$SERVICE_NAME ./BackEnd/bmrbdep/pyproject.toml /opt/wsgi/

# Install Python dependencies inside venv
RUN pip install --no-cache-dir .

# Copy code and config
COPY --chown=$SERVICE_NAME:$SERVICE_NAME ./wsgi.conf /opt/wsgi/wsgi.conf
COPY --chown=$SERVICE_NAME:$SERVICE_NAME ./BackEnd/bmrbdep/ /opt/wsgi/bmrbdep/
COPY --chown=$SERVICE_NAME:$SERVICE_NAME ./version.txt /opt/wsgi/bmrbdep/

CMD ["uwsgi", "--ini", "/opt/wsgi/wsgi.conf"]
