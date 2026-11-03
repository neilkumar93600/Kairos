#!/usr/bin/env sh
# Installs the pinned Railway CLI (Linux x86_64) for the Railway workflows, after checking the release asset's SHA-256
# (the npm package downloads its binary in a postinstall script, which CI never runs). Bump both lines together:
#   gh api repos/railwayapp/cli/releases/tags/<version> --jq '.assets[] | select(.name | endswith("x86_64-unknown-linux-musl.tar.gz")) | .digest'
set -eu
VERSION=v5.71.0
SHA256=2e682fd2ddf8d6fdf9e46d9d99d99646ff0022a6abb0c2bca93011348a269fb9

tmp=$(mktemp -d)
curl -fsSL -o "$tmp/railway.tgz" "https://github.com/railwayapp/cli/releases/download/$VERSION/railway-$VERSION-x86_64-unknown-linux-musl.tar.gz"
echo "$SHA256  $tmp/railway.tgz" | sha256sum -c -
mkdir -p "$HOME/.local/bin"
tar -xzf "$tmp/railway.tgz" -C "$HOME/.local/bin" railway
echo "$HOME/.local/bin" >> "${GITHUB_PATH:-/dev/null}"
"$HOME/.local/bin/railway" --version
