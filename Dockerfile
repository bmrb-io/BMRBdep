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
    rm -r /root/.cache

COPY ./BackEnd/app/*py /opt/wsgi/
COPY ./BackEnd/app/configuration.json /opt/wsgi/
COPY ./BackEnd/app/schema_data /opt/wsgi/
COPY ./BackEnd/app/requirements.txt /opt/wsgi/
COPY ./FrontEnd/dist /opt/wsgi/html

RUN cd /opt/wsgi && chown -R uwsgi:uwsgi .
RUN pip3 install --no-cache-dir -r /opt/wsgi/requirements.txt && apk --purge del .build-deps

ARG configfile
ENV configfile=${configfile:-./development.conf}
COPY ${configfile} /opt/wsgi/wsgi.conf

CMD [ "uwsgi", "--ini", "/opt/wsgi/wsgi.conf" ]
