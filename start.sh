#!/bin/bash

# Winter Arc App - Start Script
# This script starts both the frontend and backend concurrently

echo "🚀 Starting Winter Arc App..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if required directories exist
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Required directories 'backend' and 'frontend' not found."
    echo "   Please run this script from the project root directory."
    exit 1
fi

# Start PostgreSQL if not running
echo "🗄️  Checking PostgreSQL status..."
if ! pg_ctl -D ~/.postgresql/data status > /dev/null 2>&1; then
    echo "🗄️  Starting PostgreSQL..."
    pg_ctl -D ~/.postgresql/data -l ~/.postgresql/logfile start
    sleep 2  # Give PostgreSQL time to start
else
    echo "✅ PostgreSQL is already running"
fi

# Check if database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw winter_arc_db; then
    echo "📊 Creating database..."
    createdb winter_arc_db
    echo "📊 Running migrations..."
    psql winter_arc_db -f backend/migrations/create_tables.sql > /dev/null
fi

# Install backend dependencies if node_modules doesn't exist
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

# Install frontend dependencies if node_modules doesn't exist
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

echo "🔧 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo "🎨 Starting frontend development server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Winter Arc App is starting up!"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait
