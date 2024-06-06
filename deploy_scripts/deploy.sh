source ~/.nvm/nvm.sh

cd /var/www/exxohub/backend/

git pull

nvm use 22.1.0

npm i

rm .env

cp .env.prod  .env

pm2 kill 

pm2 start index.js  --name="exxo-server"

