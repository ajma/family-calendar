#!/bin/sh
# Generate a runtime environment config file for the SPA
echo "window._env_ = {" > /usr/share/nginx/html/env-config.js
echo "  GOOGLE_CLIENT_ID: \"${GOOGLE_CLIENT_ID}\"" >> /usr/share/nginx/html/env-config.js
echo "};" >> /usr/share/nginx/html/env-config.js

# Execute the main command (starts nginx)
exec "$@"
