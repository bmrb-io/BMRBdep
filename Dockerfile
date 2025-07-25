FROM python:3.13-slim

EXPOSE 9000
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

# Create virtual environment
ENV VENV_PATH="/opt/venv"
RUN python3 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# Upgrade pip inside venv
RUN pip install --upgrade pip setuptools wheel uwsgi

# Copy pyproject.toml early for caching
COPY ./BackEnd/bmrbdep/pyproject.toml /opt/wsgi/

# Install Python dependencies inside venv
RUN pip install --no-cache-dir .

# Copy static files
COPY ./wsgi.conf /opt/wsgi/wsgi.conf
COPY ./BackEnd/schema/schema_data/ /opt/wsgi/schema_data/
COPY ./FrontEnd/dist/ /opt/wsgi/dist/

# Copy backend code last for caching efficiency
COPY ./BackEnd/bmrbdep/ /opt/wsgi/bmrbdep/

CMD ["uwsgi", "--ini", "/opt/wsgi/wsgi.conf"]
