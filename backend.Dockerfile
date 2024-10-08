FROM python:3.10
WORKDIR /app
# JavaScript runtime is needed for pyTwistyScrambler
RUN apt update && apt install nodejs -y

COPY backend/requirements.txt ./
RUN pip install -r ./requirements.txt

COPY backend ./

EXPOSE 8080
CMD ["python3", "main.py"]