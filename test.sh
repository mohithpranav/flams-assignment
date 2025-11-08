#!/bin/bash

# QueueCTL Test Script for Linux/Mac

echo "===================================="
echo " QueueCTL Test Script"
echo "===================================="
echo ""

# Clean up old data
rm -f data/queuectl.json data/config.json

echo "Test 1: Enqueue a simple job"
node bin/queuectl.js enqueue '{"id":"test1","command":"echo Hello World"}'
echo ""

echo "Test 2: Check status"
node bin/queuectl.js status
echo ""

echo "Test 3: Enqueue more jobs"
node bin/queuectl.js enqueue '{"id":"test2","command":"echo Job 2"}'
node bin/queuectl.js enqueue '{"id":"test3","command":"sleep 2"}'
node bin/queuectl.js enqueue '{"id":"test-fail","command":"exit 1","max_retries":2}'
echo ""

echo "Test 4: List all jobs"
node bin/queuectl.js list
echo ""

echo "Test 5: Check configuration"
node bin/queuectl.js config get
echo ""

echo "Test 6: Update configuration"
node bin/queuectl.js config set max-retries 5
node bin/queuectl.js config get
echo ""

echo ""
echo "===================================="
echo "All basic tests completed!"
echo "===================================="
echo ""
echo "To test workers, run:"
echo "  node bin/queuectl.js worker start --count 2"
echo ""
