# virtual Rubik's cube racing

Deployment:

Create a copy of the .env.example file in the same directory and name the file .env

Fill in the .env file
New database will be created with given credentials.

ADMIN_USERNAME and ADMIN_PASSWORD are credentials to default admin account in the web application

APP_SECRET is a flask secret and JWT file is a secret used for decoding password reset URLS

Lastly, MAIL_* variables are used for sending Password Reset emails via SMTP


Then, use the following command to build and deploy with docker (tested with Docker version 26.1.2)
## Setup
```Shell
docker compose up
```