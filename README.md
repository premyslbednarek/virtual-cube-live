# virtual Rubik's cube racing

Before deploying the app, change DB_PASSWORD, ADMIN_PASSWORD and APP_SECRET to new secret values.

DB_PASSWORD is the password for postgres database
ADMIN_PASSWORD is the password for default admin web app account
APP_SECRET is a secret for Flask

Use the following command to build and deploy with docker (tested with Docker version 26.1.2)
## Setup
```Shell
docker compose up
```