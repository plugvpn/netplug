# Local builds: commit is taken from git when available. Override for reproducible builds:
#   make build GIT_COMMIT=deadbeef
# Docker passes GIT_COMMIT via build-arg (see Dockerfile).

CGO_ENABLED ?= 1
GIT_COMMIT ?= $(shell git rev-parse HEAD 2>/dev/null)
VERSION_PKG := netplug-go/internal/version

LDFLAGS := -s -w -X $(VERSION_PKG).Commit=$(GIT_COMMIT)

OUTPUT ?= bin/netplug

.PHONY: all build clean test

all: build

build:
	CGO_ENABLED=$(CGO_ENABLED) go build -trimpath -ldflags "$(LDFLAGS)" -o $(OUTPUT) ./cmd/netplug

test:
	CGO_ENABLED=$(CGO_ENABLED) go test ./...

clean:
	rm -f $(OUTPUT)
