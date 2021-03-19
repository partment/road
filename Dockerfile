FROM python:3-alpine

WORKDIR /app

RUN apk update && apk add --no-cache mariadb-connector-c mariadb-connector-c-dev build-base linux-headers pcre pcre-dev

COPY requirements ./
RUN pip install --no-cache-dir -r requirements

COPY api /app/api
COPY index.html /app/api/templates/index.html
COPY assets /app/api/templates/assets

WORKDIR /app/api

CMD [ "uwsgi", "--ini", "/app/api/app.ini" ]