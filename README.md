# virtual Rubik's cube racing

Deployment:

Create a copy of the .env.example file in the same directory and rename the file to .env

Fill in the .env file
New database will be created with given credentials.

ADMIN_USERNAME and ADMIN_PASSWORD are credentials to default admin account in the web application

APP_SECRET is a flask secret and JWT file is a secret used for decoding password reset URLS

Lastly, MAIL_* variables are used for sending Password Reset emails via SMTP

To deploy the web application, use:
## Setup
```Shell
docker compose up --build
```

or
```Shell
./deployment-run
```

To run the development server, which includes live reload for both the React app and Flask server use
```Shell
sudo docker compose -f docker-compose-development.yml up --build
```
or
```Shell
./development-run
```

Unless you change the APP_PORT in the .env file, the APP should be running at localhost:3000