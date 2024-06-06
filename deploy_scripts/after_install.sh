#!/bin/bash
echo "after_install.sh"

source /root/.bashrc
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
cd /var/www/exxohub/backend

/root/.nvm/versions/node/v21.6.1/bin/npm install

/root/.nvm/versions/node/v21.6.1/bin/npm run build


