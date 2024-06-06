#!/bin/bash
echo "application_start.sh"

source /root/.bashrc
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

cd /var/www/nextjs

/root/.nvm/versions/node/v21.6.1/bin/pm2 stop 0
/root/.nvm/versions/node/v21.6.1/bin/pm2 delete 0
/root/.nvm/versions/node/v21.6.1/bin/pm2 start npm --name "next-app" -- start
/root/.nvm/versions/node/v21.6.1/bin/pm2 status
