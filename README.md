# virtual Rubik's cube

## Setup
```Shell
# install python3 virtualenv package
pip install virtualenv

# create python virtual environment
python3 -m venv env

# activate the virtual environment
source env/bin/activate

# install dependencies
pip install -r requirements.txt

# run the server
python3 main.py

# tailwind css
npm install -D tailwindcss
```

Create .env file in backend/ folder with the following contents:

ADMIN_USERNAME=admin_username
ADMIN_PASSWORD=admin_password

Make sure to change the values