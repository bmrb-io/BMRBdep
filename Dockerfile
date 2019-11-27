FROM alpine
EXPOSE 9000
WORKDIR /opt/wsgi

RUN apk update && \
    apk --no-cache add bash git ca-certificates wget uwsgi-http python3 uwsgi-python3 postgresql-libs && \
    apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev python3-dev && \
    update-ca-certificates && \
    apk --update add tzdata && \
    cp /usr/share/zoneinfo/America/Chicago /etc/localtime && \
    apk del tzdata && \
    python3 -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip3 install --upgrade pip setuptools && \
    if [ ! -e /usr/bin/pip ]; then ln -s pip3 /usr/bin/pip ; fi && \
    if [[ ! -e /usr/bin/python ]]; then ln -sf /usr/bin/python3 /usr/bin/python; fi && \
    rm -r /root/.cache && \
    mkdir /opt/wsgi/schema_data/ && \
    cd /opt/wsgi && chown -R uwsgi:uwsgi .

COPY ./BackEnd/bmrbdep/requirements.txt /opt/wsgi/
RUN pip3 install --no-cache-dir -r /opt/wsgi/requirements.txt

COPY ./BackEnd/bmrbdep /opt/wsgi/
COPY ./BackEnd/schema/schema_data /opt/wsgi/schema_data/
COPY ./FrontEnd/dist /opt/wsgi/html

ARG configfile
ENV configfile=${configfile:-./development.conf}
COPY ${configfile} /opt/wsgi/wsgi.conf

CMD [ "uwsgi", "--ini", "/opt/wsgi/wsgi.conf" ]
