# Foreman
A NodeJS server that acts as an iOS firmware keybag database a.k.a. as a "keystore", serving [Grandmaster](https://github.com/GuardianFirewall/grandmaster) formatted keysets.

[API Reference](API.md)
-----------------------

## Installation
Tested on a VPS running Ubuntu 18.04.

### Install NodeJS
Start by updating apt, installing the prerequisites, and adding the sources to apt.  
```
sudo apt update
sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates gcc g++ make
curl -sL https://deb.nodesource.com/setup_10.x | sudo bash
```

Now, update apt again and install nodejs.
```
sudo apt update
sudo apt -y install nodejs
```

#### PM2 Usage Notice
Foreman leverages [pm2.io](https://pm2.io) for live runtime montioring and providing live metrics for specific endpoints. Foreman allows clients to act with autonomy, anonymously. As such, no PM2 metric will collect any identifier that may link back to a client making requests.

### Install mongodb
Simply run the following.
```
sudo apt install -y mongodb
```

### Install Nginx
To install Nginx simply run the following.
```
sudo apt update
sudo apt install nginx
```
and allow Nginx with ufw. 
```
ufw allow "Nginx Full"
```

### Install certbot
To install certbot, using the following commands.
```
sudo add-apt-repository ppa:certbot/certbot
sudo apt update
sudo apt-get install certbot
```
Generate a certificate to use with Foreman by executing the following. Take note of where it stores your `privkey.pem` and `fullchain.pem` files.
```
certbot certonly --standalone --keep-until-expiring --agree-tos -d your_hostname_com
```

### Configure Nginx 
Create a new file named `foreman-server` in `/etc/nginx/sites-available/` and fill it with the following configuration. 

Be sure to modify the `server_name`, `ssl_certificate`, and `ssl_certificate_key` specifiers.
```
server {
    listen 80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
        listen 443 ssl;
        server_name your_hostname_com;

        ssl_certificate path_to_fullchain.pem;
        ssl_certificate_key path_to_privkey.pem;

        location / {
        proxy_pass https://localhost:4141;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
To enable this config, make a symbolic this config in `/etc/nginx/sites-enabled/` and then run `systemctl restart nginx`.

### Install Foreman
Move your `cd` to somewhere you'd like foreman to live in and then execute the following.
```
git clone https://github.com/GuardianFirewall/foreman.git
cd foreman
npm i
```

Foreman's prerequisites should now be installed. Create a `.env` file in the foreman directory and fill it in with the following replacing values as needed.
```
FOREMAN_PORT=4141
FOREMAN_SSL_KEY=path_to_privkey.pem
FOREMAN_SSL_CERT=path_to_fullchain.pem
FOREMAN_ADMIN_DIGEST=SHA512_PASSPHRASE_DIGEST
```

`FOREMAN_DIGEST` is a SHA512 digest of the passphrase you'd like to give the root "foreman" account for the `/admin` interface.  

## Running Foreman
Execute `node app.js` to start the Foreman server.