#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py loaddata fixtures/initial_data.json || true
exec gunicorn profiles_project.wsgi:application --bind 0.0.0.0:8000
