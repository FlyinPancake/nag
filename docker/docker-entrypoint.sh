#!/bin/sh
set -e

# Set timezone (default: UTC)
TZ="${TZ:-UTC}"
if [ -f "/usr/share/zoneinfo/$TZ" ]; then
    ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
    echo "$TZ" > /etc/timezone
    echo "Timezone set to: $TZ"
else
    echo "Warning: Timezone $TZ not found, using UTC"
    TZ="UTC"
fi
export TZ

# Configure user/group IDs (defaults: 1000)
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Update group ID if needed
if [ "$(id -g nag)" != "$PGID" ]; then
    echo "Updating nag group ID to $PGID"
    groupmod -o -g "$PGID" nag
fi

# Update user ID if needed
if [ "$(id -u nag)" != "$PUID" ]; then
    echo "Updating nag user ID to $PUID"
    usermod -o -u "$PUID" nag
fi

# Ensure data directory exists and has correct permissions
mkdir -p /app/data
chown -R nag:nag /app/data

echo "Starting nag-server as user nag (uid=$PUID, gid=$PGID)"

# Drop privileges and execute main process
exec su-exec nag "$@"
