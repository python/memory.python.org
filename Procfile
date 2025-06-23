web-backend: python -m uvicorn app.main:app --uds /var/run/cabotage/cabotage.sock
web-frontend: sh -c 'node server.js & socat UNIX-LISTEN:/var/run/cabotage/cabotage.sock,fork TCP:127.0.0.1:3000'
release: echo 'doin deploy things'
