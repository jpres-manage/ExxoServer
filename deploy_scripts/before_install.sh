#!/bin/bash
echo "before_install.sh"

mkdir -p /var/www/nextjs
touch /var/www/nextjs/placeholder

xdate=`date '+%Y-%m-%d-%H-%M-%S'`

#mkdir /var/www/$xdate

#zip -r /var/www/$xdate.zip /var/www/nextjs/*
rm -rf /var/www/nextjs/*

# one time
# curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash 
# nvm install 21.6.1
# nvm run default --version
# npm install pm2 -g
