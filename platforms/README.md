# DevSoc Subcommittee Recruitment: Platforms
Your task is to send a direct message to the matrix handle `@chino:oxn.sh` using the Matrix protocol. However, this message must be sent over a self hosted instance such as through the Conduwuit implementation or the slightly more complicated Synapse implementation.

For this to work your server must be federated, but you do not have to worry about specifics such as using your domain name as your handle (a subdomain will do!) or have other 'nice to have' features. Just a message will do!

**You should write about what you tried and your process in the answer box below.**

If you don't manage to get this working we'll still want to hear about what you tried, what worked and what didn't work, etc. Good luck!

---

> ANSWER BOX

Mainly just followed the instructions from Conduwuit [Generic deployment documentation](https://conduwuit.puppyirl.gay/deploying/generic.html).

1. Make a VCN named `matrix` in OCI using the VCN Wizard. For ease, just use the default settings.

2. Create a new compute instance named `conduwuit` in the public subnet of `matrix` VCN with the following settings:
    - Image: Ubuntu 24.04
    - Shape: VM.Standard.A1.Flex (1 OCPU, 6GB RAM)
    - Primary VNIC IP addresses: Automatically assign public IPv4 address

   Save the generated private key for SSH access.

3. Open [Termius](https://termius.com/) and SSH into the instance using the assigned IPv4 address and generated private key.

4. Upgrade the system packages:

    ```bash
    sudo apt update
    sudo apt upgrade -y
    ```

5. Install [mise-en-place](https://mise.jdx.dev) to manage the installation of Conduwuit:

    ```bash
    # https://mise.jdx.dev/installing-mise.html#apt
    sudo apt update -y && apt install -y gpg sudo wget curl
    sudo install -dm 755 /etc/apt/keyrings
    wget -qO - https://mise.jdx.dev/gpg-key.pub | gpg --dearmor | sudo tee /etc/apt/keyrings/mise-archive-keyring.gpg 1> /dev/null
    echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.gpg arch=arm64] https://mise.jdx.dev/deb stable main" | sudo tee /etc/apt/sources.list.d/mise.list
    sudo apt update
    sudo apt install -y mise
    ```

6. Activate mise:

    ```bash
    echo 'eval "$(mise activate bash --shims)"' | sudo tee -a /root/.bashrc
    sudo bash -c "source /root/.bashrc"
    ```

   Activate mise in the root because `systemd` services run as root.

7. Install Conduwuit:

    ```bash
    sudo mise use -g ubi:girlbossceo/conduwuit[matching=static]@0.5.0-rc3
    ```

8. Allow ingress traffic on the following ports in `Default Security List` of the `matrix` VCN:
    - Stateless: No
    - Source Type: CIDR
    - Source CIDR: 0.0.0.0/0
    - IP Protocol: TCP
    - Source Port Range: All
    - Destination Port Range: 443, 8448

9. Open the ports in iptables:

    ```bash
    sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
    sudo iptables -A INPUT -p tcp --dport 8448 -j ACCEPT
    sudo netfilter-persistent save
    ```

10. Set up systemd service for Conduwuit:

    ```bash
    sudo mise doctor -J | jq -r .dirs.shims
    # copy from https://conduwuit.puppyirl.gay/configuration/examples.html#debian-systemd-unit-file
    # `ExecStart` should be the path to the shim shown by the above command followed by `/conduwuit`
    # `Environment` somehow doesn't work, so remove it and configure the config path with --config in ExecStart
    # e.g. `ExecStart=/root/.local/share/mise/shims/conduwuit --config /etc/conduwuit/conduwuit.toml`
    # remove `DynamicUser`, `User`, and `Group` as I don't create a separate user for Conduwuit
    # comment out `ProtectHome` as it causes permission issues with mise installed tools
    sudo nano /etc/systemd/system/conduwuit.service
    ```

    <details>
    <summary>`/etc/systemd/system/conduwuit.service`</summary>

    ```ini
    [Unit]
    Description=conduwuit Matrix homeserver
    Wants=network-online.target
    After=network-online.target
    Documentation=https://conduwuit.puppyirl.gay/

    [Service]
    Type=notify-reload
    ReloadSignal=SIGUSR1

    TTYPath=/dev/tty25
    DeviceAllow=char-tty
    StandardInput=tty-force
    StandardOutput=tty
    StandardError=journal+console
    TTYReset=yes
    # uncomment to allow buffer to be cleared every restart
    TTYVTDisallocate=no

    TTYColumns=120
    TTYRows=40

    ExecStart=/root/.local/share/mise/shims/conduwuit --config /etc/conduwuit/conduwuit.toml

    ReadWritePaths=/var/lib/conduwuit /etc/conduwuit

    AmbientCapabilities=
    CapabilityBoundingSet=

    DevicePolicy=closed
    LockPersonality=yes
    MemoryDenyWriteExecute=yes
    NoNewPrivileges=yes
    #ProcSubset=pid
    ProtectClock=yes
    ProtectControlGroups=yes
    #ProtectHome=yes
    ProtectHostname=yes
    ProtectKernelLogs=yes
    ProtectKernelModules=yes
    ProtectKernelTunables=yes
    ProtectProc=invisible
    ProtectSystem=strict
    PrivateDevices=yes
    PrivateMounts=yes
    PrivateTmp=yes
    PrivateUsers=yes
    PrivateIPC=yes
    RemoveIPC=yes
    RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
    RestrictNamespaces=yes
    RestrictRealtime=yes
    RestrictSUIDSGID=yes
    SystemCallArchitectures=native
    SystemCallFilter=@system-service @resources
    SystemCallFilter=~@clock @debug @module @mount @reboot @swap @cpu-emulation @obsolete @timer @chown @setuid @privileged @keyring @ipc
    SystemCallErrorNumber=EPERM
    #StateDirectory=conduwuit

    RuntimeDirectory=conduwuit
    RuntimeDirectoryMode=0750

    Restart=on-failure
    RestartSec=5

    TimeoutStopSec=2m
    TimeoutStartSec=2m

    StartLimitInterval=1m
    StartLimitBurst=5

    [Install]
    WantedBy=multi-user.target
    ```

    </details>

11. Create a Conduwuit configuration file:


    ```bash
    sudo mkdir /etc/conduwuit
    # copy from https://conduwuit.puppyirl.gay/configuration/examples.html#example-configuration
    sudo nano /etc/conduwuit/conduwuit.toml
    ```

    - `server_name` must be uncommented and set to `"matrix.risunosu.com"`, the domain I own
    - `database_path` must be uncommented and set to `"/var/lib/conduwuit"`
    - `allow_registration` must be set to `true` to allow registration of new users
    - `registration_token_file = "/etc/conduwuit/.reg_token"` is required to allow registration of new users
    - `allow_federation` must be set to `true` to allow federation

    The configuration file can be found in [./conduwuit.toml](./conduwuit.toml).

12. Install caddy for reverse proxy:

    ```bash
    sudo mise use -g aqua:caddyserver/caddy
    ```

13. Set up systemd service for Caddy:

    ```bash
    sudo mise doctor -J | jq -r .dirs.shims
    # copy from https://github.com/caddyserver/dist/blob/master/init/caddy.service
    # `ExecStart` and `ExecReload` should be the path to the shim shown by the above command followed by `/caddy`
    # remove `User` and `Group` as I don't create a separate user for Caddy
    sudo nano /etc/systemd/system/caddy.service
    ```

    <details>
    <summary>`/etc/systemd/system/caddy.service`</summary>

    ```ini
    # caddy.service
    #
    # For using Caddy with a config file.
    #
    # Make sure the ExecStart and ExecReload commands are correct
    # for your installation.
    #
    # See https://caddyserver.com/docs/install for instructions.
    #
    # WARNING: This service does not use the --resume flag, so if you
    # use the API to make changes, they will be overwritten by the
    # Caddyfile next time the service is restarted. If you intend to
    # use Caddy's API to configure it, add the --resume flag to the
    # `caddy run` command or use the caddy-api.service file instead.

    [Unit]
    Description=Caddy
    Documentation=https://caddyserver.com/docs/
    After=network.target network-online.target
    Requires=network-online.target

    [Service]
    Type=notify
    ExecStart=/root/.local/share/mise/shims/caddy run --environ --config /etc/caddy/Caddyfile
    ExecReload=/root/.local/share/mise/shims/caddy reload --config /etc/caddy/Caddyfile --force
    TimeoutStopSec=5s
    LimitNOFILE=1048576
    PrivateTmp=true
    ProtectSystem=full
    AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE

    [Install]
    WantedBy=multi-user.target
    ```

    </details>

14. Create a Caddyfile:

    ```bash
    # copy from https://conduwuit.puppyirl.gay/deploying/generic.html#caddy
    # `/etc/caddy/conf.d/` seems not to work, so use `/etc/caddy/Caddyfile`
    # substitute `your.server.name` with `matrix.risunosu.com`
    # use 8008 as the port instead of 6167 as the default port of Conduwuit is 8008
    sudo nano /etc/caddy/Caddyfile
    ```

    <details>
    <summary>`/etc/caddy/Caddyfile`</summary>

    ```caddy
    matrix.risunosu.com, matrix.risunosu.com:8448 {
        # TCP reverse_proxy
        reverse_proxy 127.0.0.1:8008
        # UNIX socket
        #reverse_proxy unix//run/conduwuit/conduwuit.sock
    }
    ```

    </details>

15. Start and enable the services:

    ```bash
    sudo systemctl enable --now caddy
    sudo systemctl enable --now conduwuit
    ```

16. Add a DNS record for the domain `matrix.risunosu.com` to point to the public IP address of the instance in Cloudflare.

17. Create a [Configuration rule](https://developers.cloudflare.com/rules/configuration-rules/) in Cloudflare to set the encryption mode to `Flexible` for the domain `matrix.risunosu.com`:

    - Expression: `(http.host eq "matrix.risunosu.com")`
    - SSL: Flexible

   This is required as the instance does not have an SSL certificate, but I need to use HTTPS to use `app.element.io`.  
   The flexible mode is not recommended for production because the connection between Cloudflare and the server is not encrypted, but I don't want to configure SSL certificates for the origin.

Here, I noticed the reverse proxy is not required as I use Cloudflare. So, I disabled Caddy:

```bash
sudo systemctl disable --now caddy
```

Also, I changed the security list of OCI and iptables to allow TCP traffic on port 8008.

```bash
sudo iptables -A INPUT -p tcp --dport 8008 -j ACCEPT
sudo iptables -L INPUT --line-number
sudo iptables -D INPUT <line number of 443>
sudo iptables -L INPUT --line-number
sudo iptables -D INPUT <line number of 8448>
sudo netfilter-persistent save
```

However, `sudo ss -tulnp` doesn't show any process listening on port `8008` when I set `global.address` in the Conduwuit config to the IPv4 address of the instance, while it shows `8008` when I set `global.address` to `127.0.0.1`.  
This is the same even if I run Conduwuit manually with `sudo /root/.local/share/mise/shims/conduwuit --config /etc/conduwuit/conduwuit.toml`.  
Also, if I try to connect with curl, it shows `curl: (7) Failed to connect to 64.110.97.211 port 8008 after 379 ms: Couldn't connect to server`.  
Since even a simple web server with Bun cannot be accessed from the public IP address, the issue should be firewall related.

The cause was miss-ordering of the iptables rules. The rules should be added before the `REJECT` rule, but it was:

```plaintext
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p icmp -j ACCEPT
-A INPUT -i lo -j ACCEPT
-A INPUT -p udp -m udp --sport 123 -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
-A INPUT -j REJECT --reject-with icmp-host-prohibited
-A INPUT -p tcp -m tcp --dport 8008 -j ACCEPT
```

I reordered the rules then the server got accessible from the public IP address. Really stupid mistake took me hours to figure out.

Then, the next step is to setup proxy server to forward the traffic on both `443` and `8448` to `8008`.  
I tried to use `443` in the origin, but it threw an error `curl: (35) OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number` because I didn't configure SSL certificates for the origin.  
I should configure it but I don't want to for now, so I use `8008` in the origin.

1. Create a [Origin rule](https://developers.cloudflare.com/rules/origin-rules/) in Cloudflare to forward the traffic on both `443` and `8448` to `8008`, actually, forward all traffic to `8008`:

    - Expression: `(http.host eq "matrix.risunosu.com")`
    - Destination Port: Rewrite to `8008`

2. Edit `/etc/conduwuit/conduwuit.toml` to set `global.address` to `"0.0.0.0"`, and `global.port` to `8008`.

3. Re-enable the Conduwuit service:

    ```bash
    sudo systemctl enable --now conduwuit
    ```

Then, `https://matrix.risunosu.com` returns `hewwo from conduwuit woof!` as expected.  
Of course, `https://matrix.risunosu.com:443` also returns the same response, but `https://matrix.risunosu.com:8448` cannot be accessed because Cloudflare doesn't allow the port not listed [here](https://developers.cloudflare.com/fundamentals/reference/network-ports/).

For now, at least I can access the server without federation, so I'll try to create an account using [`app.element.io`](https://app.element.io/#/register).

1. Create `/etc/conduwuit/.reg_token` and set the registration token:

    ```bash
    sudo nano /etc/conduwuit/.reg_token
    ```

2. Register a new account using [`app.element.io`](https://app.element.io/#/register) with the homeserver `matrix.risunosu.com`.

Yay! I successfully registered a new account on the self-hosted Matrix server!

However, as I expected, I cannot send a direct message to `@chino:oxn.sh` because the user cannot be found.  
I checked the federation availability using [`Matrix federation tester`](https://federationtester.matrix.org/#matrix.risunosu.com), and it shows `Connection Errors`.  
Hence, I need to forward or open port `8448` somehow.  
I think the only way to achieve this is to disable Cloudflare proxy by setting the `matrix` subdomain to [DNS-only](https://developers.cloudflare.com/dns/proxy-status/#dns-only-records), then configure the SSL certificate for the origin.  
I don't care much about the safety of the connection, but `app.element.io` requires HTTPS to connect to the server.
