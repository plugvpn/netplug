# syntax=docker/dockerfile:1

ARG GO_VERSION=1.24
FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /src
RUN apk add --no-cache build-base
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o /out/netplug ./cmd/netplug

FROM alpine:3.21 AS runner
WORKDIR /app
RUN apk add --no-cache wireguard-tools iptables sqlite iproute2 ca-certificates
ENV DATA_DIR=/data
ENV SQLITE_PATH=/data/netplug.sqlite
ENV HTTP_ADDR=:8080
EXPOSE 8080
COPY --from=builder /out/netplug /usr/local/bin/netplug
CMD ["netplug"]
