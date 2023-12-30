---
title: "Modern Java Backend"
---

???+ "Modern Java Backend Components"  
    SpringBoot + Mybatis + Mysql + Docker

### 1. 踩坑记录

`MyBatis` 需要正确配置一下依赖项，否则会出现很多奇怪的错误，包括不能正确`@AutoWired`等：

```gradle
implementation 'org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.1'
implementation 'org.mybatis:mybatis'
implementation 'org.mybatis:mybatis-spring'
implementation 'mysql:mysql-connector-java:8.0.27'
```

---

`@RestController`下面的方法，需要返回需要包一下，不能直接返回：

```kotlin
@GetMapping("{id}", produces = [MediaType.APPLICATION_JSON_VALUE])
fun getUser(@PathVariable id: Long): ResponseEntity<User> {
  val user: User? = mUserMapper.selectUserById(id);
  if (user != null) {
      return ResponseEntity.ok(mUserMapper.selectUserById(id))
  } else {
      throw ResourcesNotFoundException("此用户不存在")
  }
}
```

---

部署到Docker时，需要先启动mysql，并设置对外的 IP 地址：

```shell
docker run --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=<password> -d mysql:latest
```

然后部署Java程序，并设置对外的 IP 地址：

```shell
docker run --name eatwhat.backend.container -p 8080:8080 eatwhat.backend
```

同时，这里的`MyBatis`配置需要同步为机器IP：

```text
spring.datasource.url=jdbc:mysql://192.168.50.4:3306/test
```

使用 Java 程序 API 时，也需要指定 IP 地址：

```text
curl --location 'http://192.168.50.4:8080/api/users/2' --header 'Content-Type: application/json'
```

> 进入 Docker 中 mysql 镜像的命令为： `docker exec -it mysql mysql -uroot -p`

docker-compose 本地编译运行[backend]服务命令：

```
./gradlew clean build && docker build -t images.backend:latest . && docker-compose up backend
```

---

`Nginx` 配置 `location` 时，如果在 `nginx.conf` 中配置，要在 `include` 之前配置， 且 `server` 块中也要配置 `listen` 等字段，不然 `location` 不生效。

如果将 `Nginx` + 前端网站 + 后端服务通过 `docker-compose` 部署在一起，且用 `Nginx` 实现反向代理，需要注意下配置：

=== "docker-compose.yml"

    ``` yml
    version: '3.8'

    services:
    nginx:
        image: nginx
        container_name: nginx
        restart: always
        ports:
            - "80:80"
        volumes:
            - ./nginx.conf:/etc/nginx/nginx.conf
            - image-volume:/var/www/html/uploads
        privileged: true

    backend:
        build:
        context: .
        dockerfile: Dockerfile
        container_name: backend
        restart: always
        ports:
            - "63312:8080"
        volumes:
            - image-volume:/app/uploads

    frontend:
        build:
        context: ./../../Flutter/images_frontend
        dockerfile: Dockerfile
        container_name: frontend
        restart: always
        ports:
            - "63313:80"

    volumes:
        image-volume:
    ```

=== "nginx.conf"

    ``` java
    # nginx线上配置，www子域名保留作为入口
    # nginx反代/webapp/到app子域名，用来承载h5页面
    # 反代/api /portal到api子域名，用来作为后端服务
    user  nginx;
    worker_processes  auto;

    error_log  /var/log/nginx/error.log notice;
    pid        /var/run/nginx.pid;


    events {
        worker_connections  1024;
    }

    http {
        include       /etc/nginx/mime.types;
        default_type  application/octet-stream;

        log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                        '$status $body_bytes_sent "$http_referer" '
                        '"$http_user_agent" "$http_x_forwarded_for"';

        access_log  /var/log/nginx/access.log  main;

        sendfile        on;
        #tcp_nopush     on;

        keepalive_timeout  65;

        #gzip  on;

        upstream backend {
        server host.docker.internal:63312;
        }

        upstream frontend {
        server host.docker.internal:63313;
        }

        ssl_session_cache   shared:SSL:10m;
        ssl_session_timeout 10m;

        server {
            listen 80 default_server;

            server_name _;

            return 301 https://$host$request_uri;
        }

        # www
        server {
            #listen       80;
            #listen  [::]:80;
            listen 443 ssl default_server;
            server_tokens off;
            keepalive_timeout 70;
            server_name  www.yorek.xyz;
            ssl_certificate /etc/nginx/certs/www.yorek.xyz.pem;
            ssl_certificate_key /etc/nginx/certs/www.yorek.xyz.key;
            ssl_session_timeout 5m;
            ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
            ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
            ssl_prefer_server_ciphers on;

            #access_log  /var/log/nginx/host.access.log  main;

            location / {
                root   /usr/share/nginx/html;
                index  index.html index.htm;
            }

            #error_page  404              /404.html;

            # redirect server error pages to the static page /50x.html
            #
            error_page   500 502 503 504  /50x.html;
            location = /50x.html {
                root   /usr/share/nginx/html;
            }

            location /uploads/ {
                alias /var/www/html/uploads/;
                autoindex on;

                add_header 'Access-Control-Allow-Origin' 'https://app.yorek.xyz' always;
                add_header 'Access-Control-Allow-Credentials' 'true' always;
                add_header 'Access-Control-Allow-Methods' 'GET, PUT, DELETE, POST, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
                add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
            }
        }

        # app site for webapp
        server {
            listen 443 ssl;
            server_tokens off;
            keepalive_timeout 70;
            server_name  app.yorek.xyz;
            ssl_certificate /etc/nginx/certs/app.yorek.xyz.pem;
            ssl_certificate_key /etc/nginx/certs/app.yorek.xyz.key;
            ssl_session_timeout 5m;
            ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
            ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
            ssl_prefer_server_ciphers on;

            location /webapp/ {
                proxy_pass http://frontend/;
                proxy_redirect http://frontend /webapp/;

                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            }
        }

        # api site for backend
        server {
            listen 443 ssl;
            server_tokens off;
            keepalive_timeout 70;
            server_name  api.yorek.xyz;
            ssl_certificate /etc/nginx/certs/api.yorek.xyz.pem;
            ssl_certificate_key /etc/nginx/certs/api.yorek.xyz.key;
            ssl_session_timeout 5m;
            ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
            ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
            ssl_prefer_server_ciphers on;

            location /api/ {
                proxy_pass         http://backend/api/;
                proxy_http_version 1.1;
                proxy_set_header   Connection "";

                proxy_set_header   Host $host;
                proxy_set_header   X-Real-IP $remote_addr;
                proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header   X-Forwarded-Host $server_name;

                if ($request_method = 'OPTIONS') {
                    add_header 'Access-Control-Allow-Origin' 'https://app.yorek.xyz' always;
                    add_header 'Access-Control-Allow-Credentials' 'true' always;
                    add_header 'Access-Control-Allow-Methods' 'GET, PUT, DELETE, POST, OPTIONS' always;
                    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
                    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
                    add_header 'Access-Control-Max-Age' 1728000 always;
                    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
                    add_header 'Content-Length' 0 always;
                    return 204;
                }

                add_header 'Access-Control-Allow-Origin' 'https://app.yorek.xyz' always;
                add_header 'Access-Control-Allow-Credentials' 'true' always;
                add_header 'Access-Control-Allow-Methods' 'GET, PUT, DELETE, POST, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
                add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
            }

            location /portal/ {
                proxy_pass         http://backend/portal/;
                proxy_http_version 1.1;
                proxy_set_header   Connection "";

                proxy_set_header   Host $host;
                proxy_set_header   X-Real-IP $remote_addr;
                proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header   X-Forwarded-Host $server_name;

                if ($request_method = 'OPTIONS') {
                    add_header 'Access-Control-Allow-Origin' 'https://app.yorek.xyz' always;
                    add_header 'Access-Control-Allow-Credentials' 'true' always;
                    add_header 'Access-Control-Allow-Methods' 'GET, PUT, DELETE, POST, OPTIONS' always;
                    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
                    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
                    add_header 'Access-Control-Max-Age' 1728000 always;
                    add_header 'Content-Type' 'text/plain; charset=utf-8' always;
                    add_header 'Content-Length' 0 always;
                    return 204;
                }

                add_header 'Access-Control-Allow-Origin' 'https://app.yorek.xyz' always;
                add_header 'Access-Control-Allow-Credentials' 'true' always;
                add_header 'Access-Control-Allow-Methods' 'GET, PUT, DELETE, POST, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
                add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
            }
        }
    }
    ```

--- 

Spring 有默认的 `/error` 接口用来兜底内部的错误。在配置了鉴权后，需要将此 path 配置为不需要鉴权。