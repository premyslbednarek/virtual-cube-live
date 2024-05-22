# Virtual Cube Live

The Virtual Cube Live project is split into:
- the backend folder, which includes a python Flask application
- the frontend folder, which includes a React single-page application
- the tests folder, which includes Playwright end-to-end tests
- and deployment files that are located in the root folder of this project


# Deployment
Create a copy of the .env.example and name it .env
```Shell
cp .env.example .env
```

Then, fill in the .env file
- ADMIN_USERNAME and ADMIN_PASSWORD are credentials to default admin account in the web application
- APP_SECRET is a flask secret and JWT file is a secret used for decoding password reset URLS
- MAIL_* variables are used for sending Password Reset emails via SMTP

To deploy the web application, use:
```Shell
./deployment-run
```
or:
```Shell
docker compose up --build
```

If the the build process is successfull, the app should be running at localhost with the port specified in the .env file.

# Development
To run the development server, which includes live reload for both the React app and Flask server use
```Shell
./development-run
```
or:
```Shell
sudo docker compose -f docker-compose-development.yml up --build
```

The the start of the development server is successfull, the app should be running at localhost with the port specified in the .env file.


# Tests
To run the tests, start by running the development container by running ./development-run. The tests expect that the application is run on port 3000.

Then, navigate to the tests folder and install npm dependencies
```Shell
cd tests
npm install
npx playwright install chromium
sudo npx playwright install-deps
```

To launch the tests, fisrt open playwright UI and start the test by pressing F5 or by pressing the play button in the UI. To launch the UI, use:
```Shell
npx playwright test
```