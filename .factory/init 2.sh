#!/bin/bash
set -e

cd /Users/seb/Documents/claim-remedy-leads-testing

# Install Python dependencies
pip install -r requirements.txt 2>/dev/null || python3 -m pip install -r requirements.txt

# Install JS dependencies
npm install

echo "[init] Environment ready"
