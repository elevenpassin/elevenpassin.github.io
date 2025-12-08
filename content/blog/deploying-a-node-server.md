---
title: Deploying a Node Server on a bare metal VPS
description: This was my exploration on how to deploy a Node.js to production on a bare metal server.
date: 2025-12-08
tags: ["posts", "node.js", "server", "vps", "cloud", "production", "linux", "hetzner"]
---

For a personal project I was working on, I wanted to deploy a nodejs server directly on the VPS without using any of the container solutions as it was a fairly basic project. I came up with a deployment guide for that project, which I'm now publishing to the public.

## Table Of Contents

- [Table Of Contents](#table-of-contents)
- [Deployment](#deployment)
  - [Prepare the production server](#prepare-the-production-server)
    - [The root user](#the-root-user)
    - [Creating a user account for your application](#creating-a-user-account-for-your-application)
    - [Setting up a firewall](#setting-up-a-firewall)
    - [Setting up SSH login for the application user](#setting-up-ssh-login-for-the-application-user)
  - [Setting up NodeJS](#setting-up-nodejs)
    - [Install curl](#install-curl)
    - [Download the setup script](#download-the-setup-script)
    - [Run the setup script with sudo](#run-the-setup-script-with-sudo)
    - [Install Node.js](#install-nodejs)
    - [Verify that node is installed](#verify-that-node-is-installed)
    - [Setting up NPM / Yarn](#setting-up-npm--yarn)
    - [Installing build-essential package](#installing-build-essential-package)
    - [Setting up Yarn (optional)](#setting-up-yarn-optional)
  - [Copying over the server code](#copying-over-the-server-code)
  - [Configuring the server](#configuring-the-server)
    - [Env Variables](#env-variables)
  - [Setting up PM2](#setting-up-pm2)
- [Resources](#resources)

## Deployment

### Prepare the production server

Use your preferred cloud platform to create a linux server with specs based on your needs. To access the VPS via SSH, refer to your cloud platform's docs on how to setup an SSH key on a newly created VPS.
Once a linux server has been created (I am deploy on a Debian server, hosted at Hetzner), we can then
prepare the server for production usage.

#### The root user

Generally speaking, you should get access to the root user when you create a server, which should allow you to ssh into the server using the command below:

```sh
$ ssh root@your_server_ip_addr
```

Once you have logged in, immediately the first thing to do is to set a password to the root account.

Use the command below to change password:

```sh
root $ passwd
```

#### Creating a user account for your application

Since working with root directly is generally discouraged for various security and safety reasons, we'll create a seperate user account with limited permissions who's job is to run the server.

When following the next steps, replace all instances of `server_username` with your own username. To be more clear, I've included the user performing each action at the beginning of each command.

Use the command below to create a new user account:

```sh
root $ adduser server_username
```

We can now provide our new user with admin privileges so we don't have to switch to root user every time we need to do an administrative task. This will allow the new user to do administrative tasks by prepending `sudo` to their commands.

```sh
root $ usermod -aG sudo server_username
```

#### Setting up a firewall

We can make use of `ufw` firewall to limit the extent of ports etc that general public can access. To do this, first make sure to install `ufw` on the server:

```sh
root $ apt install ufw
```

Now that we have `ufw` installed, it's time to configure it. You can try to run the following command to see if we can already start configuring various applications' access through firewall:

```sh
root $ ufw app list
```

We need to make sure that the firewall allows SSH connections so that we can log back in next time, we can allow these connections by typing:

```sh
root $ ufw allow OpenSSH
```

and then we enable the firewall itself:

```sh
root $ ufw enable
```

You can check the status of the firewall by typing in:

```sh
root $ ufw status
```

#### Setting up SSH login for the application user

For our application user that we created a few steps back, if you try to ssh using the command below:

```sh
$ ssh server_username@your_server_addr
```

You will be prompted to enter the user password to login, but since we already have our public SSH key on the server configured for the `root` user, we can just copy over the root user's `.ssh/authorized_keys` folder into our server user's home folder.

We can do this using rsync:

```sh
root $ rsync --archive --chown=server_username:server_username ~/.ssh /home/server_username/.ssh
```

Now you should be able to simply SSH into your server without typing in your password.

### Setting up NodeJS

Now, let's use our newly created application user to setup NodeJS.
For this, I'm using [NodeSource](https://github.com/nodesource/distributions) as they provide binary distributions for most major versions of NodeJS.

Simply follow the installation instructions from their github page. As I am using a debian server, I'll be using the instructions for Debian:

#### Install curl

```sh
server_username $ sudo apt install -y curl
```

#### Download the setup script

```sh
server_username $ curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
```

#### Run the setup script with sudo

```sh
server_username $ sudo -E bash nodesource_setup.sh
```

#### Install Node.js

```sh
server_username $ sudo apt-get install -y nodejs
```

#### Verify that node is installed

```sh
server_username $ node -v
```

#### Setting up NPM / Yarn

Generally speaking, NPM should come part of the Node.js package, so if you have nodejs installed, you should be able to also use Npm, you can verify that npm is installed by typing:

```sh
server_username $ npm -v
```

#### Installing build-essential package

For some NPM packages, we often need to locally compile the native binaries from source, for example in the case of node-gyp. To make it possible, we can install the `build-essential` package as it will install various tools like `make`, `gcc` etc on our system.

```sh
server_username $ sudo apt install build-essential
```

#### Setting up Yarn (optional)

My project uses yarn for it's package management, so let's install yarn:

```sh
server_username $ npm i -g yarn@latest     # installation
server_username $ yarn -v                  # verification
```

### Copying over the server code

You can just copy over the server code from your local machine to the server by using `scp`. But before you do that, make sure that you make a production copy of your server folder and then remove any unwanted folders like `.git`, `node_modules`, `.yarn` etc.

Run this on your local machine to copy over the server code:

```sh
$ scp -rp ./prod_server_folder server_username@your_server_addr:/home/server_username/app
```

You might have to rename or move the server folder to an appropriate directory on the server once you have uploaded everything. I uploaded my local prod version of the server code (in `prod_server_folder`) to my server at `/home/server_username/app`.

### Configuring the server

At this point, you should just be able to use `node path/to/server.js` or equivalent to run the server. Please note that the server will not be available to public yet as we currently only allow SSH connections through the `ufw` firewall.

Before we configure the firewall, we should first setup the server itself.

#### Env Variables

Make sure to update the env variables file in the server folder, specifically configure the server to run on port `80` (since we're only doing http for now) as well as any other env variables like the database URL etc.

At the end of this step you should be able to already start a production server, albiet without any daemon in place to handle automatic restarts etc.

### Setting up PM2

PM2 is going to be our daemon controller, it will setup a daemon for our server so that any time our server has to restart, the daemon will make sure that the server is also restarted and up and running again.

To install PM2, just run:

```sh
server_username $ sudo npm install pm2@latest -g
```

Now you can instruct PM2 to start the server

```sh
server_username $ sudo pm2 start path/to/server.js
```

This will add your server to PM2's process list. Applications running on this process list will be automatically restarted if the app crashes or is killed. We can also take one additional step to make sure that the app is run on system startup:

```sh
server_username $ sudo pm2 startup systemd
```

This will ask you to run a specific command with sudo permissions in your terminal, once that is done, a [systemd unit](https://wiki.archlinux.org/title/Systemd#Using_units) is created, that runs a pm2 process on boot for `server_username` user. This pm2 instance in turn will run the server itself.

Now that the server is up and running you should do one last thing before accessing the server and that is to allow http connections on port 80.

```sh
server_username $ sudo ufw allow 80 # alternative: sudo ufw allow http
```

You can verify that access to port 80 is allowed by typing in:

```sh
server_username $ sudo ufw status
```

Congratulations! You have accessfully setup a nodejs server for production!

You can now visit `http://your_server_addr` to checkout your newly setup server!

## Resources

Now that we've got the basics sorted, there's still a lot more we can do such as setting up Let's Encrypt and configuring Database access etc. I have some resources below that I've used to write this blog, feel free to take a look at them to go more indepth into some of the more advanced concepts.

- [Express Tutorial Part 7: Deploying to production](https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs/deployment)
- [How to Set Up a Firewall with UFW on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-firewall-with-ufw-on-ubuntu)
- [Understanding Nginx HTTP Proxying, Load Balancing, Buffering, and Caching](https://www.digitalocean.com/community/tutorials/understanding-nginx-http-proxying-load-balancing-buffering-and-caching)
- [How To Set Up a Node.js Application for Production on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04)
- [How To Configure Remote Access for MongoDB on Ubuntu 20.04](https://www.digitalocean.com/community/tutorials/how-to-configure-remote-access-for-mongodb-on-ubuntu-20-04)
- [https://advancedweb.hu/how-to-use-lets-encrypt-with-node-js-and-express/](https://advancedweb.hu/how-to-use-lets-encrypt-with-node-js-and-express/)
