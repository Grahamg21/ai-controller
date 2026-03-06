#!/bin/bash
echo "Starting AI Controller..."

# Boot backend
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Boot frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend running at http://localhost:8000"
echo "Frontend running at http://localhost:5173"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT SIGTERM
wait
