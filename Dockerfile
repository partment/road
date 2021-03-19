FROM python:alpine

WORKDIR /app

RUN apk update && apk add --no-cache mariadb-connector-c mariadb-connector-c-dev build-base linux-headers

COPY requirements ./
RUN pip install --no-cache-dir -r requirements

COPY api /app/api
COPY index.html /app/api/templates/index.html
COPY assets /app/api/templates/assets

CMD [ "uwsgi", "--ini", "/app/api/app.ini" ]