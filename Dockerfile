# syntax=docker/dockerfile:1
ARG GO_VERSION=1.24
FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /src

RUN apk add --no-cache build-base make

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# With .dockerignore excluding .git, set the source revision at build time so the UI
# and "Access Server version" reflect the artifact. Example:
#   docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) -t netplug .
ARG GIT_COMMIT=
RUN CGO_ENABLED=1 GOOS=linux make build OUTPUT=/out/netplug GIT_COMMIT="${GIT_COMMIT}"

FROM alpine:3.21 AS runner

ENV DATA_DIR=/data
ENV SQLITE_PATH=/data/netplug.sqlite
ENV HTTP_ADDR=:8080

WORKDIR /app

RUN apk add --no-cache \
    wireguard-tools \
    iptables \
    sqlite \
    iproute2 \
    ca-certificates

# Traffic control CLI: `/sbin/tc` is provided by Alpine's iproute2 (listed above).

EXPOSE 8080

COPY --from=builder /out/netplug /usr/local/bin/netplug
ENTRYPOINT ["netplug"]
