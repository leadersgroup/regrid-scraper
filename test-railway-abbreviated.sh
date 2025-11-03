#!/bin/bash

echo "Testing Railway with abbreviated address..."
curl -X POST https://regrid-scraper-production.up.railway.app/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{"address": "13109 Tollcross Wy, Winter Garden, FL 34787"}' \
  | python3 -m json.tool
