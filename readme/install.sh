#!/usr/bin/env bash
# add as dependency to your project
deno add jsr:@hugojosefson/httpstatus

# ...or...

# create and enter a directory for the script
mkdir -p "httpstatus"
cd       "httpstatus"

# download+extract the script, into current directory
curl -fsSL "https://github.com/hugojosefson/httpstatus/tarball/main" \
  | tar -xzv --strip-components=1
